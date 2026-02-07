import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAgentByUserId, getPaymentsByAgent } from '../../src/lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { userId, limit } = req.query

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' })
        }

        // Get agent wallet
        const agent = await getAgentByUserId(userId)
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' })
        }

        // Get payment history
        const limitNum = limit ? parseInt(limit as string) : 50
        const payments = await getPaymentsByAgent(agent.id, limitNum)

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

    } catch (error: any) {
        console.error('Error fetching payment history:', error)
        return res.status(500).json({
            error: 'Failed to fetch payment history',
            message: error.message
        })
    }
}
