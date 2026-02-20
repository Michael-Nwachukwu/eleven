import type { VercelRequest, VercelResponse } from '@vercel/node'

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
        // Dynamic import to avoid ESM/CJS cycle on Node v24
        const { getAgentByUserId, getDecryptedPrivateKey } = await import('../../src/lib/db')

        const { userId, action } = req.query

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' })
        }

        // ── Private key retrieval (for agent wallet signing) ──────────────
        if (action === 'private-key') {
            const privateKey = await getDecryptedPrivateKey(userId)
            if (!privateKey) {
                return res.status(404).json({ error: 'Agent not found or no private key' })
            }
            return res.status(200).json({ privateKey })
        }

        // ── Default: return agent info ────────────────────────────────────
        const agent = await getAgentByUserId(userId)

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' })
        }

        // Return agent info (without private key)
        return res.status(200).json({
            id: agent.id,
            adminAddress: agent.adminAddress,
            agentAddress: agent.agentAddress,
            createdAt: agent.createdAt,
            isActive: agent.isActive
        })

    } catch (error: any) {
        console.error('Error fetching agent:', error)
        return res.status(500).json({
            error: 'Failed to fetch agent',
            message: error.message
        })
    }
}
