import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAgentWallet as createAgentWalletInDB, getAgentByUserId } from '../../src/lib/db'
import { createAgentWallet as createThirdwebWallet } from '../../src/services/thirdweb-agent-service'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { userId } = req.body

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        // Check if agent already exists
        const existingAgent = await getAgentByUserId(userId)
        if (existingAgent) {
            return res.status(409).json({
                error: 'Agent already exists for this user',
                agent: {
                    id: existingAgent.id,
                    adminAddress: existingAgent.adminAddress,
                    agentAddress: existingAgent.agentAddress,
                    createdAt: existingAgent.createdAt
                }
            })
        }

        // Create ThirdWeb wallet
        const { adminAddress, agentAddress, privateKey } = await createThirdwebWallet(userId)

        // Store in database with encrypted private key
        const agent = await createAgentWalletInDB(
            userId,
            adminAddress,
            agentAddress,
            privateKey
        )

        // Return agent info (without private key)
        return res.status(201).json({
            id: agent.id,
            adminAddress: agent.adminAddress,
            agentAddress: agent.agentAddress,
            createdAt: agent.createdAt
        })

    } catch (error: any) {
        console.error('Error creating agent:', error)
        return res.status(500).json({
            error: 'Failed to create agent',
            message: error.message
        })
    }
}
