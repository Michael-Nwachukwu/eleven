import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT') {
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

        // ── Resolve Address to ENS Name (GET) ─────────────────────────────
        if (req.method === 'GET' && action === 'resolve-address') {
            const { address } = req.query
            if (!address || typeof address !== 'string') {
                return res.status(400).json({ error: 'address is required' })
            }
            const { getEnsNameByAddress } = await import('../../src/lib/db')
            const ensName = await getEnsNameByAddress(address)
            return res.status(200).json({ ensName })
        }

        // ── Check ENS Availability (GET) ──────────────────────────────────
        if (req.method === 'GET' && action === 'check-ens') {
            const { name } = req.query
            if (!name || typeof name !== 'string') {
                return res.status(400).json({ error: 'name is required' })
            }
            const { isEnsNameTaken } = await import('../../src/lib/db')
            const taken = await isEnsNameTaken(name)
            return res.status(200).json({ available: !taken })
        }

        // ── Update ENS Name (POST) ────────────────────────────────────────
        if (req.method === 'POST' && action === 'update-ens') {
            const { agentName } = req.body
            console.log('[update-ens] userId:', userId, 'agentName:', agentName)
            if (!agentName) return res.status(400).json({ error: 'agentName is required' })

            const agent = await getAgentByUserId(userId as string)
            console.log('[update-ens] agent lookup result:', agent ? `found (${agent.agentAddress})` : 'NOT FOUND')
            if (!agent) return res.status(404).json({ error: 'Agent not found' })

            const sanitizedName = agentName.toLowerCase().replace(/[^a-z0-9-]/g, '')
            console.log('[update-ens] sanitizedName:', sanitizedName)

            const { isEnsNameTaken, updateAgentMetadata } = await import('../../src/lib/db')
            const { registerEnsSubdomain, deleteEnsSubdomain } = await import('../../src/services/namestone-service')

            const isTaken = await isEnsNameTaken(sanitizedName)
            console.log('[update-ens] isTaken:', isTaken)
            if (isTaken && agent.ensName !== sanitizedName) {
                return res.status(409).json({ error: 'ENS name already taken' })
            }

            try {
                // Remove old name if it exists and is different
                if (agent.ensName && agent.ensName !== sanitizedName) {
                    console.log('[update-ens] Deleting old ENS name:', agent.ensName)
                    await deleteEnsSubdomain(agent.ensName)
                }

                // Register new name via NameStone
                console.log('[update-ens] Registering ENS subdomain:', sanitizedName, 'for address:', agent.agentAddress)
                console.log('[update-ens] NAMESTONE_API_KEY set:', !!process.env.NAMESTONE_API_KEY)
                await registerEnsSubdomain(sanitizedName, agent.agentAddress, {
                    description: `Eleven Autonomous Agent: ${agentName}`,
                })
                console.log('[update-ens] ENS registration successful')

                await updateAgentMetadata(userId as string, { ensName: sanitizedName, agentName })
                console.log('[update-ens] Metadata updated successfully')
                return res.status(200).json({ success: true, ensName: sanitizedName })
            } catch (err: any) {
                console.error('[update-ens] ERROR:', err.message)
                console.error('[update-ens] Full error:', err)
                return res.status(500).json({ error: 'Failed to update ENS', details: err.message })
            }
        }

        // ── Mint Agent Identity (POST) ────────────────────────────────────
        if (req.method === 'POST' && action === 'mint-identity') {
            const agent = await getAgentByUserId(userId as string)
            if (!agent) return res.status(404).json({ error: 'Agent not found' })

            if (agent.erc8004TokenId) {
                return res.status(400).json({ error: 'Agent identity already minted' })
            }

            const { mintAgentIdentityOffchain } = await import('../../src/services/erc8004-service')

            try {
                const tokenId = await mintAgentIdentityOffchain(userId as string, {
                    agentName: agent.agentName || 'Eleven Agent',
                    ensName: agent.ensName,
                    address: agent.agentAddress
                })

                return res.status(200).json({ success: true, tokenId })
            } catch (err: any) {
                console.error('Minting error:', err)
                return res.status(500).json({ error: 'Failed to mint identity', details: err.message })
            }
        }

        // ── Default: return agent info ────────────────────────────────────
        if (req.method !== 'GET') {
            // If it's a POST/PUT without a handled action, fail
            return res.status(400).json({ error: 'Invalid action for this method' })
        }

        const agent = await getAgentByUserId(userId as string)

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' })
        }

        // Return agent info (without private key)
        return res.status(200).json({
            id: agent.id,
            adminAddress: agent.adminAddress,
            agentAddress: agent.agentAddress,
            createdAt: agent.createdAt,
            isActive: agent.isActive,
            ensName: agent.ensName,
            agentName: agent.agentName,
            erc8004TokenId: agent.erc8004TokenId
        })

    } catch (error: any) {
        console.error('Error fetching agent:', error)
        return res.status(500).json({
            error: 'Failed to fetch agent',
            message: error.message
        })
    }
}
