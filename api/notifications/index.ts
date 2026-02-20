import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Combined notifications handler:
 *   POST /api/notifications?action=send-receipt  — send payment receipt emails
 *   GET  /api/notifications?action=settings      — get notification email setting
 *   PUT  /api/notifications?action=settings      — update notification email setting
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()

    const action = (req.query.action as string) || 'send-receipt'

    // ── Notification settings ─────────────────────────────────────────────
    if (action === 'settings') {
        const userId = (req.query.userId as string) || (req.body?.userId as string)
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' })
        }

        const { getAgentByUserId, updateAgentNotificationEmail } = await import('../../src/lib/db')

        if (req.method === 'GET') {
            const agent = await getAgentByUserId(userId)
            if (!agent) return res.status(404).json({ error: 'Agent not found' })
            return res.status(200).json({ notificationEmail: agent.notificationEmail || '' })

        } else if (req.method === 'PUT') {
            const { email } = req.body || {}
            if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email is required' })
            const updated = await updateAgentNotificationEmail(userId, email.trim().toLowerCase())
            if (!updated) return res.status(404).json({ error: 'Agent not found' })
            return res.status(200).json({ success: true, notificationEmail: email.trim().toLowerCase() })

        } else {
            return res.status(405).json({ error: 'Method not allowed' })
        }
    }

    // ── Send receipt ──────────────────────────────────────────────────────
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const { orderId, payerEmail, payerName } = req.body || {}
        console.log('[send-receipt] Request body:', { orderId, payerEmail, payerName })
        if (!orderId) return res.status(400).json({ error: 'orderId is required' })

        const { getPaymentOrderById, getAgentByUserId, getOrderFulfillments } = await import('../../src/lib/db')
        const { EmailService } = await import('../../src/lib/email-service')

        const order = await getPaymentOrderById(orderId)
        console.log('[send-receipt] Order found:', order ? order.id : 'NOT FOUND', '| mode:', order?.mode)
        if (!order) return res.status(404).json({ error: 'Order not found' })

        const merchantAgent = await getAgentByUserId(order.userId)
        const merchantEmail = merchantAgent?.notificationEmail
        console.log('[send-receipt] Merchant email:', merchantEmail || 'NOT SET')

        const fulfillments = await getOrderFulfillments(orderId)

        const currency = order.mode === 'fiat' ? (order.metadata?.currency || order.currency || 'NGN') : (order.token || 'USDC')
        const amount = order.mode === 'fiat' ? (order.metadata?.originalAmount || order.amount) : order.amount
        console.log('[send-receipt] Currency:', currency, '| Amount:', amount)

        const { payerSent, merchantSent, payerError, merchantError } = await EmailService.sendPaymentReceipt({
            payerEmail: payerEmail || undefined,
            payerName: payerName || undefined,
            merchantEmail: merchantEmail || undefined,
            amount: String(amount),
            currency,
            orderId: order.id,
            description: order.description || 'Payment',
            mode: order.mode,
            merchantName: undefined,
            totalFulfilled: fulfillments.length,
            date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        })

        console.log('[send-receipt] Result — payerSent:', payerSent, '| merchantSent:', merchantSent)
        return res.status(200).json({
            success: true,
            payerSent,
            merchantSent,
            payerError,
            merchantError,
            debug: {
                payerEmailProvided: !!payerEmail,
                merchantEmailFound: !!merchantEmail,
                apiKeySet: !!process.env.RESEND_API_KEY,
                orderFound: !!order,
                orderId: order.id,
            }
        })
    } catch (error: any) {
        console.error('[send-receipt] Unhandled error:', error)
        return res.status(500).json({ error: error.message || 'Failed to send notifications' })
    }
}
