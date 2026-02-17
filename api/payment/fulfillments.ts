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
        // Dynamic import to avoid ESM/CJS cycle on Node v24
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
