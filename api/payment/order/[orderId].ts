import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const { orderId } = req.query

    if (!orderId || typeof orderId !== 'string') {
        return res.status(400).json({ error: 'orderId is required' })
    }

    try {
        // Dynamic import to avoid ESM/CJS cycle on Node v24
        const { getPaymentOrderById, updatePaymentOrder, getOrderFulfillments, deletePaymentOrder } = await import('../../../src/lib/db')

        if (req.method === 'GET') {
            const order = await getPaymentOrderById(orderId)
            if (!order) {
                return res.status(404).json({ error: 'Order not found' })
            }

            // Also fetch fulfillments
            const fulfillments = await getOrderFulfillments(orderId)

            return res.status(200).json({ order, fulfillments })

        } else if (req.method === 'PATCH') {
            const { x402Uri, status, description } = req.body || {}

            // Build update fields (only allow safe fields)
            const fields: Record<string, any> = {}
            if (x402Uri !== undefined) fields.x402Uri = x402Uri
            if (status !== undefined) fields.status = status
            if (description !== undefined) fields.description = description

            if (Object.keys(fields).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' })
            }

            const updated = await updatePaymentOrder(orderId, fields)
            if (!updated) {
                return res.status(404).json({ error: 'Order not found' })
            }

            return res.status(200).json(updated)

        } else if (req.method === 'DELETE') {
            const deleted = await deletePaymentOrder(orderId)
            if (!deleted) {
                return res.status(404).json({ error: 'Order not found' })
            }
            return res.status(200).json({ success: true, message: 'Order deleted' })

        } else {
            return res.status(405).json({ error: 'Method not allowed' })
        }
    } catch (error: any) {
        console.error('Order API error:', error)
        return res.status(500).json({ error: error.message || 'Internal server error' })
    }
}
