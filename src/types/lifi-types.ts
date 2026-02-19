import type { Route } from '@lifi/sdk'

// Supported chains for scanning balances
export const SUPPORTED_CHAINS = [
    { id: 42161, name: 'Arbitrum', shortName: 'ARB', color: '#28a0f0' },
    { id: 8453, name: 'Base', shortName: 'BASE', color: '#0052ff' },
    { id: 10, name: 'Optimism', shortName: 'OP', color: '#ff0420' },
    { id: 534352, name: 'Scroll', shortName: 'SCR', color: '#ffeeda' },
    { id: 324, name: 'zkSync Era', shortName: 'ZKS', color: '#8c8dfc' },
] as const

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id']

// Tokens to scan per chain
export interface ChainToken {
    symbol: string
    address: string // '0x0000...' for native ETH
    decimals: number
    isNative?: boolean
}

// Balance of a specific token on a specific chain
export interface ChainBalance {
    chainId: number
    chainName: string
    chainShortName: string
    chainColor: string
    token: string          // symbol e.g. 'USDC'
    tokenAddress: string
    decimals: number
    rawBalance: bigint
    balance: string        // human-readable e.g. '12.34'
    balanceUSD: number
}

// A single source that will contribute to covering the shortfall
export interface DepositSource {
    chainId: number
    chainName: string
    token: string
    amount: string         // human-readable amount to use
    amountUSD: number
    route: Route           // LI.FI route object (null for same-chain)
    estimatedTimeSeconds: number
    estimatedFeesUSD: number
}

// The overall deposit plan computed from balances
export interface DepositPlan {
    depositAmountUSD: number   // what user asked for
    existingArbitrumUSD: number // already on Arbitrum
    shortfallUSD: number       // still needed
    maxSpendableUSD: number    // total available cross-chain
    canCoverFull: boolean      // can fully cover the deposit
    sources: DepositSource[]   // routes to execute (in order)
}

// Execution status for a single source route
export type RouteStatus = 'pending' | 'transferring' | 'approving' | 'swapping' | 'bridging' | 'done' | 'failed'

export interface RouteExecution {
    sourceIndex: number
    chainName: string
    token: string
    amount: string
    status: RouteStatus
    substep?: string           // human-readable description e.g. "Approving USDC on Scroll…"
    txHash?: string
    txLink?: string            // explorer link for current process
    error?: string
}
