export interface AgentWalletData {
    id: string
    userId: string
    adminWalletAddress: string
    agentWalletAddress: string
    sessionKeyAddress?: string
    sessionKeyExpiry?: Date
    config: AgentConfig
    createdAt: Date
}

export interface AgentConfig {
    name: string
    riskTolerance: 'conservative' | 'balanced' | 'aggressive'
    spendingLimit: string
    spendingToken: 'USDC' | 'ETH'
}

export interface SessionKeyData {
    address: string
    maxAmountPerTx: string
    validUntil: number
    approvedTokens: string[]
}
