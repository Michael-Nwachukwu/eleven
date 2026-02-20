import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Combined payment orders/history handler:
 *   GET  /api/payment/orders               — list orders for user
 *   POST /api/payment/orders               — create new order
 *   GET  /api/payment/orders?action=history — payment history for agent wallet
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const action = req.query.action as string | undefined

    try {
        const db = await import('../../src/lib/db')

        // ── Payment History (agent-level) ──────────────────────────────────
        if (action === 'history') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

            const { userId, limit } = req.query
            if (!userId || typeof userId !== 'string') {
                return res.status(400).json({ error: 'userId is required' })
            }

            const agent = await db.getAgentByUserId(userId)
            if (!agent) return res.status(404).json({ error: 'Agent not found' })

            const limitNum = limit ? parseInt(limit as string) : 50
            const payments = await db.getPaymentsByAgent(agent.id, limitNum)

            return res.status(200).json({
                payments: payments.map(p => ({
                    id: p.id,
                    transactionHash: p.transactionHash,
                    paymentType: p.paymentType,
                    amount: p.amount,
                    token: p.token,
                    status: p.status,
                    metadata: p.metadata,
                    createdAt: p.createdAt
                }))
            })
        }

        // ── Orders ─────────────────────────────────────────────────────────
        if (req.method === 'GET') {
            const { userId, limit } = req.query
            if (!userId || typeof userId !== 'string') {
                return res.status(400).json({ error: 'userId is required' })
            }
            const limitNum = limit ? parseInt(limit as string) : 50
            const orders = await db.getPaymentOrdersByUser(userId, limitNum)
            return res.status(200).json({ orders })
        }

        if (req.method === 'POST') {
            const { userId, order } = req.body
            if (!userId || !order) {
                return res.status(400).json({ error: 'userId and order are required' })
            }
            const newOrder = await db.createPaymentOrder(userId, order)
            return res.status(201).json(newOrder)
        }

        return res.status(405).json({ error: 'Method not allowed' })

    } catch (error: any) {
        console.error('Error in payment orders API:', error)
        return res.status(500).json({ error: 'Internal server error', message: error.message })
    }
}
