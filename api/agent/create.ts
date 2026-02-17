import type { VercelRequest, VercelResponse } from '@vercel/node'

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
        // Dynamic imports to avoid ESM/CJS cycle on Node v24
        const { createAgentWallet: createAgentWalletInDB, getAgentByUserId } = await import('../../src/lib/db')
        const { createThirdwebClient } = await import('thirdweb')
        const { privateKeyAccount } = await import('thirdweb/wallets')

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

        // Create ThirdWeb client using process.env (server-side)
        const client = createThirdwebClient({
            clientId: process.env.VITE_THIRDWEB_CLIENT_ID || '',
        })

        // Generate a random private key
        const privateKey = `0x${Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
        ).join('')}` as `0x${string}`

        // Create admin account from private key
        const adminAccount = privateKeyAccount({
            client,
            privateKey,
        })

        const adminAddress = adminAccount.address
        const agentAddress = adminAccount.address // Use same address for now

        // Store in database with encrypted private key
        const agent = await createAgentWalletInDB(
            userId,
            adminAddress,
            agentAddress,
            privateKey
        )

        // Return agent info including private key (for client-side signing)
        return res.status(201).json({
            id: agent.id,
            adminAddress: agent.adminAddress,
            agentAddress: agent.agentAddress,
            createdAt: agent.createdAt,
            privateKey: privateKey // Return the raw private key once
        })

    } catch (error: any) {
        console.error('Error creating agent:', error)
        return res.status(500).json({
            error: 'Failed to create agent',
            message: error.message
        })
    }
}
