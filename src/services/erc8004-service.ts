/**
 * ERC-8004 Agent Identity Service (Option A: Off-chain MVP)
 * 
 * Provides verifiable identity for AI agents based on the ERC-8004 standard.
 * Currently stores identity metadata off-chain (in Redis via db.ts)
 * but formats it exactly as an on-chain ERC-721 tokenURI would.
 */

import { updateAgentMetadata } from '../lib/db'

export interface AgentMetadata {
    name: string
    description: string
    image?: string
    external_url?: string
    attributes: {
        trait_type: string
        value: string
    }[]
    agent_capabilities: string[]
    contact_endpoints: {
        type: string
        url: string
    }[]
}

/**
 * Builds the ERC-8004 standard JSON metadata for an agent
 */
export function buildAgentMetadata(agent: {
    agentName: string
    ensName?: string
    address: string
}): AgentMetadata {
    return {
        name: agent.agentName,
        description: 'Autonomous Payment Agent operating on the Eleven Platform',
        external_url: agent.ensName ? `https://app.ens.domains/${agent.ensName}.0xkitchens.eth` : undefined,
        attributes: [
            { trait_type: 'Protocol', value: 'Eleven' },
            { trait_type: 'Status', value: 'Active' },
            { trait_type: 'Type', value: 'Merchant Smart Account' }
        ],
        agent_capabilities: [
            'x402-payment-receiver',
            'usdc-arbitrum-settlement',
            'fiat-crypto-bridging'
        ],
        contact_endpoints: [
            // Example of how an agent could expose an API
            { type: 'x402-proxy', url: 'https://elevenbots.vercel.app/api/proxy' }
        ]
    }
}

/**
 * "Mints" the agent identity off-chain.
 * For the MVP, it generates a pseudo tokenId and saves the metadata struct
 * back into the agent's record in Redis. 
 * Migration to Arbitrum ERC-721 is as simple as calling 
 * a real contract here instead of just updating the DB.
 */
export async function mintAgentIdentityOffchain(
    userId: string,
    agentDetails: { agentName: string; ensName?: string; address: string }
): Promise<string> {
    // 1. Build the metadata
    const metadata = buildAgentMetadata(agentDetails)

    // 2. Here, in a real on-chain flow, we would upload `metadata` to IPFS 
    //    and call `erc8004Contract.registerAgent(...)`

    // 3. Instead, for the MVP, we just assign a pseudo pseudo-random hex token ID
    //    to represent the generated identity
    const pseudoTokenId = '8004-' + Math.floor(Math.random() * 1000000).toString()

    await updateAgentMetadata(userId, {
        erc8004TokenId: pseudoTokenId
    })

    return pseudoTokenId
}
