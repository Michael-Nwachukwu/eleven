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
        const { createPaymentOrder, getPaymentOrdersByUser } = await import('../../src/lib/db')

        if (req.method === 'GET') {
            const { userId, limit } = req.query

            if (!userId || typeof userId !== 'string') {
                return res.status(400).json({ error: 'userId is required' })
            }

            const limitNum = limit ? parseInt(limit as string) : 50
            const orders = await getPaymentOrdersByUser(userId, limitNum)

            return res.status(200).json({ orders })
        }

        if (req.method === 'POST') {
            const { userId, order } = req.body

            if (!userId || !order) {
                return res.status(400).json({ error: 'userId and order are required' })
            }

            const newOrder = await createPaymentOrder(userId, order)
            return res.status(201).json(newOrder)
        }

        return res.status(405).json({ error: 'Method not allowed' })

    } catch (error: any) {
        console.error('Error in payment orders API:', error)
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}
