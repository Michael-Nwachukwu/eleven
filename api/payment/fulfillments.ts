import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        const { addFulfillment, getOrderFulfillments } = await import('../../src/lib/db')

        if (req.method === 'GET') {
            const { orderId } = req.query

            if (!orderId || typeof orderId !== 'string') {
                return res.status(400).json({ error: 'orderId is required' })
            }

            const fulfillments = await getOrderFulfillments(orderId)
            return res.status(200).json({ fulfillments })
        }

        if (req.method === 'POST') {
            const { orderId, fulfillment } = req.body

            if (!orderId || !fulfillment) {
                return res.status(400).json({ error: 'orderId and fulfillment are required' })
            }

            const newFulfillment = await addFulfillment(orderId, fulfillment)

            // ── Auto-Invest: deposit % of incoming CRYPTO payments into Aave ──
            // Must be awaited inline — Vercel serverless kills the process after
            // res.json(), so setImmediate / fire-and-forget doesn't work.
            // Fiat payments (paymentMethod: 'aeon') are explicitly excluded.
            const isCrypto = fulfillment.paymentMethod !== 'aeon'

            if (isCrypto && fulfillment.amount) {
                try {
                    const {
                        getAgentByOrderId,
                        getDecryptedPrivateKey,
                        updateAgentMetadata,
                    } = await import('../../src/lib/db')
                    const { autoInvestFromPayment } = await import('../../src/services/aave-service')

                    const agent = await getAgentByOrderId(orderId)
                    console.log('[Yield] Agent lookup for order', orderId, '→', agent?.yieldEnabled, agent?.yieldAllocationPercent)

                    if (agent?.yieldEnabled && agent.yieldAllocationPercent && agent.yieldAllocationPercent > 0) {
                        const privateKey = await getDecryptedPrivateKey(agent.userId)
                        if (privateKey) {
                            // Monthly limit tracking — reset if new month
                            const nowMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
                            const monthlyInvested = agent.yieldLastResetMonth === nowMonth
                                ? (agent.yieldMonthlyInvested ?? 0)
                                : 0

                            const receivedUsdc = parseFloat(fulfillment.amount)
                            console.log(`[Yield] Auto-investing ${agent.yieldAllocationPercent}% of ${receivedUsdc} USDC`)

                            const { invested, txHash } = await autoInvestFromPayment({
                                receivedUsdc,
                                allocationPercent: agent.yieldAllocationPercent,
                                monthlyLimit: agent.yieldMonthlyLimit ?? 0,
                                monthlyInvested,
                                agentPrivateKey: privateKey,
                            })

                            if (invested > 0) {
                                await updateAgentMetadata(agent.userId, {
                                    yieldMonthlyInvested: monthlyInvested + invested,
                                    yieldLastResetMonth: nowMonth,
                                } as any)
                                console.log(`[Yield] ✅ Auto-invested ${invested.toFixed(2)} USDC → Aave (tx: ${txHash})`)
                            } else {
                                console.log('[Yield] Skipped — monthly limit reached or dust amount')
                            }
                        } else {
                            console.warn('[Yield] No private key found for agent')
                        }
                    }
                } catch (yieldErr: any) {
                    // Non-fatal — never break the fulfillment response for yield errors
                    console.error('[Yield] Auto-invest failed:', yieldErr?.message || yieldErr)
                }
            }

            return res.status(201).json(newFulfillment)
        }

        return res.status(405).json({ error: 'Method not allowed' })

    } catch (error: any) {
        console.error('Error in payment fulfillments API:', error)
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}
