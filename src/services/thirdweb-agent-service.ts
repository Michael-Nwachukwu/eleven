import { createThirdwebClient } from 'thirdweb'
import { smartWallet, privateKeyAccount } from 'thirdweb/wallets'
import { arbitrum } from 'thirdweb/chains'

// Initialize ThirdWeb client
export const thirdwebClient = createThirdwebClient({
    clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID!,
})

/**
 * Create agent wallet for user
 * Uses Privy for authentication, ThirdWeb for smart account
 */
export async function createAgentWallet(userId: string) {
    try {
        console.log('Creating agent wallet for user:', userId)

        // Generate a private key for the admin wallet (stored securely)
        // In production, retrieve from encrypted database
        const privateKey = `0x${Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
        ).join('')}` as `0x${string}`

        console.log('Generated private key')

        // Create admin account from private key
        const adminAccount = privateKeyAccount({
            client: thirdwebClient,
            privateKey,
        })

        console.log('Created admin account:', adminAccount.address)

        // For now, use the admin account address as the agent address
        // Smart wallet deployment can be done later when needed
        // This avoids hanging on gas sponsorship configuration

        return {
            adminAddress: adminAccount.address,
            agentAddress: adminAccount.address, // Use same address for now
            privateKey, // Return this ONCE to store securely
            agentWallet: null, // Will be created on-demand when needed
        }
    } catch (error) {
        console.error('Error creating agent wallet:', error)
        throw new Error(`Failed to create agent wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Create session key for autonomous operations
 */
export async function createSessionKey(
    agentWallet: any,
    permissions: {
        maxAmountPerTx: string // In USDC (6 decimals)
        validityDays: number
    }
) {
    try {
        const sessionKey = await agentWallet.createSessionKey({
            approvedTargets: [
                '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
            ],
            nativeTokenLimitPerTransaction: permissions.maxAmountPerTx,
            validUntil: Math.floor(Date.now() / 1000) + permissions.validityDays * 86400,
        })

        return sessionKey
    } catch (error) {
        console.warn('Session key creation not supported, continuing without it')
        return null
    }
}

/**
 * Get existing agent wallet from stored private key
 */
export async function getAgentWallet(privateKey: string) {
    // Recreate admin account from stored private key
    const adminAccount = privateKeyAccount({
        client: thirdwebClient,
        privateKey,
    })

    // Reconnect to smart account
    const agentWallet = smartWallet({
        chain: arbitrum,
        gasless: true,
    })

    await agentWallet.connect({
        client: thirdwebClient,
        personalAccount: adminAccount,
    })

    const agentAccount = agentWallet.getAccount()

    return {
        adminAddress: adminAccount.address,
        agentAddress: agentAccount?.address || '',
        agentWallet,
    }
}
