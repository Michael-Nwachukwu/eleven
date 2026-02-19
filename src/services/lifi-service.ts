/**
 * lifi-service.ts
 *
 * Orchestrates cross-chain deposits using the LI.FI SDK.
 * Scans balances across Arbitrum, Base, Optimism, Scroll, and zkSync Era,
 * computes the cheapest set of bridge/swap routes to cover a deposit shortfall,
 * and executes them sequentially.
 */

import {
    createConfig,
    EVM,
    getRoutes,
    executeRoute,
    type Route,
    type RouteOptions,
    type RoutesRequest,
} from '@lifi/sdk'

import {
    SUPPORTED_CHAINS,
    type ChainBalance,
    type DepositPlan,
    type DepositSource,
} from '@/types/lifi-types'
import { createWalletClient, custom, type WalletClient } from 'viem'
import { arbitrum, base, optimism, scroll, zksync } from 'viem/chains'

// Token addresses per chain. Native ETH uses the zero address sentinel.
const NATIVE_ETH = '0x0000000000000000000000000000000000000000'

type TokenMap = Record<number, { symbol: string; address: string; decimals: number }[]>

export const CHAIN_TOKENS: TokenMap = {
    // Arbitrum
    42161: [
        { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
        { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
        { symbol: 'ETH', address: NATIVE_ETH, decimals: 18 },
    ],
    // Base
    8453: [
        { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
        { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 },
        { symbol: 'ETH', address: NATIVE_ETH, decimals: 18 },
    ],
    // Optimism
    10: [
        { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
        { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
        { symbol: 'ETH', address: NATIVE_ETH, decimals: 18 },
    ],
    // Scroll
    534352: [
        { symbol: 'USDC', address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', decimals: 6 },
        { symbol: 'USDT', address: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df', decimals: 6 },
        { symbol: 'ETH', address: NATIVE_ETH, decimals: 18 },
    ],
    // zkSync Era
    324: [
        { symbol: 'USDC', address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', decimals: 6 },
        { symbol: 'USDT', address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', decimals: 6 },
        { symbol: 'ETH', address: NATIVE_ETH, decimals: 18 },
    ],
}

const VIEM_CHAINS: Record<number, any> = {
    42161: arbitrum,
    8453: base,
    10: optimism,
    534352: scroll,
    324: zksync,
}

// Destination: USDC on Arbitrum
const ARB_USDC = { chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }

// Simple ETH price fallback — real implementation would fetch from an oracle or CoinGecko
let _ethPriceUSD = 2600

export async function refreshEthPrice() {
    try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const d = await r.json()
        _ethPriceUSD = d?.ethereum?.usd ?? _ethPriceUSD
    } catch {
        // keep cached value
    }
}

// ─── SDK Initialisation ────────────────────────────────────────────────────

let _initialised = false

// Mutable refs updated before each executeRoute call.
// We store the raw EIP-1193 provider so both getWalletClient and switchChain
// can build the correct Viem WalletClient from it.
let _rawProvider: any = null
let _sourceChain: any = null
let _walletAddress: `0x${string}` | null = null

export function initLiFi() {
    if (_initialised) return
    createConfig({
        integrator: 'eleven',
        providers: [
            EVM({
                getWalletClient: async () => {
                    if (!_rawProvider || !_sourceChain || !_walletAddress) {
                        throw new Error('[LiFi] Provider not initialised. Call executeDepositPlan first.')
                    }
                    return createWalletClient({
                        account: _walletAddress,
                        chain: _sourceChain,
                        transport: custom(_rawProvider),
                    })
                },
                switchChain: async (requiredChainId: number) => {
                    if (!_rawProvider) {
                        throw new Error('[LiFi] Provider not initialised.')
                    }
                    const targetChain = VIEM_CHAINS[requiredChainId]
                    if (!targetChain) {
                        throw new Error(`[LiFi] Chain ${requiredChainId} not in VIEM_CHAINS map.`)
                    }
                    try {
                        await _rawProvider.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
                        })
                    } catch (e) {
                        console.warn('[LiFi] switchChain request failed (wallet may handle it):', e)
                    }
                    return createWalletClient({
                        account: _walletAddress ?? undefined,
                        chain: targetChain,
                        transport: custom(_rawProvider),
                    })
                },
            }),
        ],
    })
    _initialised = true
}

// ─── Balance Fetching ──────────────────────────────────────────────────────

/**
 * Fetch the token balance of an address using eth_call / eth_getBalance via a
 * public RPC.  Returns a bigint in the token's native units.
 */
async function fetchBalance(
    rpc: string,
    walletAddress: string,
    tokenAddress: string,
    isNative: boolean,
): Promise<bigint> {
    try {
        if (isNative) {
            const res = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [walletAddress, 'latest'],
                    id: 1,
                }),
            })
            const d = await res.json()
            return BigInt(d.result ?? '0x0')
        } else {
            // ERC-20: balanceOf(address)
            const data = '0x70a08231' + walletAddress.slice(2).padStart(64, '0')
            const res = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{ to: tokenAddress, data }, 'latest'],
                    id: 1,
                }),
            })
            const d = await res.json()
            return BigInt(d.result ?? '0x0')
        }
    } catch {
        return BigInt(0)
    }
}

// Public RPCs for each chain (reliable, no key required)
const CHAIN_RPCS: Record<number, string> = {
    42161: 'https://arb1.arbitrum.io/rpc',
    8453: 'https://mainnet.base.org',
    10: 'https://mainnet.optimism.io',
    534352: 'https://rpc.scroll.io',
    324: 'https://mainnet.era.zksync.io',
}

/**
 * Scan USDC, USDT, and ETH balances on all supported chains for a wallet address.
 * Returns an array of ChainBalance objects sorted by USD value descending.
 */
export async function getMultichainBalances(walletAddress: string): Promise<ChainBalance[]> {
    initLiFi()
    await refreshEthPrice()

    const tasks = SUPPORTED_CHAINS.flatMap(chain => {
        const tokens = CHAIN_TOKENS[chain.id] ?? []
        const rpc = CHAIN_RPCS[chain.id]
        return tokens.map(async token => {
            const isNative = token.address === NATIVE_ETH
            const raw = await fetchBalance(rpc, walletAddress, token.address, isNative)

            const human = Number(raw) / 10 ** token.decimals
            const usd =
                token.symbol === 'ETH'
                    ? human * _ethPriceUSD
                    : human // USDC and USDT are 1:1

            return {
                chainId: chain.id,
                chainName: chain.name,
                chainShortName: chain.shortName,
                chainColor: chain.color,
                token: token.symbol,
                tokenAddress: token.address,
                decimals: token.decimals,
                rawBalance: raw,
                balance: human.toFixed(token.symbol === 'ETH' ? 4 : 2),
                balanceUSD: Math.round(usd * 100) / 100,
            } satisfies ChainBalance
        })
    })

    const results = await Promise.allSettled(tasks)
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<ChainBalance>).value)
        .sort((a, b) => b.balanceUSD - a.balanceUSD)
}

// ─── Route Fetching ────────────────────────────────────────────────────────

/**
 * Get the best LI.FI route to move `amountUSD` worth of `token` on `fromChainId`
 * to USDC on Arbitrum, with `recipient` as the final recipient.
 *
 * Returns null if no route is available.
 */
export async function getDepositRoute(
    fromChain: ChainBalance,
    amountUSD: number,
    recipient: string,
    fromWalletAddress: string,
): Promise<Route | null> {
    initLiFi()

    // Convert USD amount to token atomic units
    const tokenAmount =
        fromChain.token === 'ETH'
            ? amountUSD / _ethPriceUSD
            : amountUSD
    const atomicAmount = BigInt(Math.floor(tokenAmount * 10 ** fromChain.decimals))

    if (atomicAmount === BigInt(0)) return null

    const routeOptions: RouteOptions = {
        slippage: 0.005,  // 0.5%
        order: 'RECOMMENDED',
    }

    const request: RoutesRequest = {
        fromChainId: fromChain.chainId,
        fromTokenAddress: fromChain.tokenAddress,
        fromAddress: fromWalletAddress,
        toChainId: ARB_USDC.chainId,
        toTokenAddress: ARB_USDC.address,
        toAddress: recipient,
        fromAmount: atomicAmount.toString(),
        options: routeOptions,
    }

    try {
        const result = await getRoutes(request)
        return result.routes[0] ?? null
    } catch (err) {
        console.error('[LiFiService] getRoutes error:', err)
        return null
    }
}

// ─── Deposit Plan Computation ──────────────────────────────────────────────

/**
 * Build a DepositPlan for depositing `depositAmountUSD` USDC to `recipientAddress`
 * on Arbitrum, given the multi-chain balances of `walletAddress`.
 *
 * Strategy:
 * 1. Separate the Arbitrum USDC balance (direct transfer, no bridge needed).
 * 2. If that covers the full amount → no bridging needed.
 * 3. Otherwise compute shortfall and select cross-chain sources greedily:
 *    - Prefer stablecoins (USDC > USDT) over ETH to minimise swap slippage.
 *    - Prefer chains with larger balances first.
 * 4. Fetch LI.FI routes for each source.
 * 5. If total available < shortfall, set canCoverFull = false and cap.
 */
export async function buildDepositPlan(
    depositAmountUSD: number,
    balances: ChainBalance[],
    walletAddress: string,
    recipientAddress: string,
): Promise<DepositPlan> {
    // ── Step 1: Arbitrum USDC available for direct transfer
    const arbUsdc = balances.find(b => b.chainId === 42161 && b.token === 'USDC')
    const existingArbitrumUSD = Math.min(arbUsdc?.balanceUSD ?? 0, depositAmountUSD)

    // ── Step 2: Early exit if Arbitrum covers everything
    if (existingArbitrumUSD >= depositAmountUSD) {
        return {
            depositAmountUSD,
            existingArbitrumUSD,
            shortfallUSD: 0,
            maxSpendableUSD: depositAmountUSD,
            canCoverFull: true,
            sources: [],
        }
    }

    const shortfallUSD = depositAmountUSD - existingArbitrumUSD

    // ── Step 3: Collect non-Arbitrum balances with meaningful value (>$0.50)
    const candidates = balances
        .filter(b => !(b.chainId === 42161) && b.balanceUSD >= 0.5)
        .sort((a, b) => {
            // Prefer stablecoins: USDC=0, USDT=1, ETH=2
            const rank = (s: string) => (s === 'USDC' ? 0 : s === 'USDT' ? 1 : 2)
            const rankDiff = rank(a.token) - rank(b.token)
            if (rankDiff !== 0) return rankDiff
            return b.balanceUSD - a.balanceUSD
        })

    // ── Step 4: Greedily select sources until shortfall is covered
    let remaining = shortfallUSD
    const selectedSources: Array<{ balance: ChainBalance; usdToUse: number }> = []

    for (const bal of candidates) {
        if (remaining <= 0) break
        const usdToUse = Math.min(bal.balanceUSD, remaining)
        selectedSources.push({ balance: bal, usdToUse })
        remaining -= usdToUse
    }

    const maxSpendableUSD =
        existingArbitrumUSD + selectedSources.reduce((sum, s) => sum + s.usdToUse, 0)
    const canCoverFull = remaining <= 0.01 // allow tiny dust

    // ── Step 5: Fetch LI.FI routes for each source
    const sourceResults = await Promise.allSettled(
        selectedSources.map(async ({ balance: bal, usdToUse }) => {
            const route = await getDepositRoute(bal, usdToUse, recipientAddress, walletAddress)
            if (!route) return null

            const estimation = route.steps[route.steps.length - 1]?.estimate
            const estimatedTimeSeconds = route.steps.reduce(
                (t, s) => t + (s.estimate?.executionDuration ?? 30),
                0,
            )
            const feesUSD = route.steps.reduce((sum, step) => {
                const fee = step.estimate?.feeCosts?.reduce(
                    (f, fc) => f + Number(fc.amountUSD ?? 0),
                    0,
                ) ?? 0
                return sum + fee
            }, 0)

            return {
                chainId: bal.chainId,
                chainName: bal.chainName,
                token: bal.token,
                amount: usdToUse.toFixed(2),
                amountUSD: usdToUse,
                route,
                estimatedTimeSeconds,
                estimatedFeesUSD: Math.round(feesUSD * 100) / 100,
            } satisfies DepositSource
        }),
    )

    const sources = sourceResults
        .filter((r): r is PromiseFulfilledResult<DepositSource | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((s): s is DepositSource => s !== null)

    return {
        depositAmountUSD,
        existingArbitrumUSD,
        shortfallUSD,
        maxSpendableUSD,
        canCoverFull,
        sources,
    }
}

// ─── Execution ─────────────────────────────────────────────────────────────

export type ExecutionUpdate = {
    sourceIndex: number       // -1 = Arbitrum direct transfer
    status: 'transferring' | 'approving' | 'swapping' | 'bridging' | 'done' | 'failed'
    substep?: string          // human-readable description
    txHash?: string
    txLink?: string
    error?: string
}

const PROCESS_LABELS: Record<string, string> = {
    TOKEN_ALLOWANCE: 'Approving token',
    PERMIT: 'Signing permit',
    SWAP: 'Swapping tokens',
    CROSS_CHAIN: 'Bridging cross-chain',
    RECEIVING_CHAIN: 'Waiting for destination',
}

/**
 * Execute all routes in the DepositPlan sequentially.
 *
 * 1. If existingArbitrumUSD > 0, execute a direct ERC-20 transfer of Arbitrum USDC
 *    to the agent wallet first.
 * 2. Then execute all LI.FI bridge routes in order.
 *
 * Calls `onUpdate` for each status change so the UI can show progress.
 */
export async function executeDepositPlan(
    plan: DepositPlan,
    getProvider: () => Promise<any>,
    onUpdate: (update: ExecutionUpdate) => void,
    recipientAddress: string,
): Promise<void> {
    initLiFi()

    // ── Step 0: Direct Arbitrum USDC transfer ────────────────────────────
    if (plan.existingArbitrumUSD > 0) {
        onUpdate({ sourceIndex: -1, status: 'transferring', substep: 'Transferring USDC on Arbitrum…' })

        try {
            const provider = await getProvider()

            // Ensure wallet is on Arbitrum
            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xa4b1' }],   // 42161
                })
            } catch { /* already on chain or wallet handles it */ }

            const accounts: string[] = await provider.request({ method: 'eth_accounts' })
            if (!accounts?.[0]) throw new Error('No wallet account found.')

            const atomicAmount = BigInt(Math.floor(plan.existingArbitrumUSD * 10 ** ARB_USDC.decimals))
            // ERC-20 transfer(address,uint256) selector = 0xa9059cbb
            const data = `0xa9059cbb${recipientAddress.slice(2).padStart(64, '0')}${atomicAmount.toString(16).padStart(64, '0')}`

            onUpdate({ sourceIndex: -1, status: 'approving', substep: 'Confirm USDC transfer in wallet…' })

            const txHash: string = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: accounts[0],
                    to: ARB_USDC.address,
                    data,
                    value: '0x0',
                }],
            })

            onUpdate({
                sourceIndex: -1,
                status: 'done',
                substep: 'Arbitrum USDC transferred!',
                txHash,
                txLink: `https://arbiscan.io/tx/${txHash}`,
            })
        } catch (err: any) {
            console.error('[LiFiService] Arbitrum transfer failed:', err)
            onUpdate({
                sourceIndex: -1,
                status: 'failed',
                substep: 'Arbitrum transfer failed',
                error: err?.message ?? 'Unknown error',
            })
            // Don't abort — continue with bridge routes even if the local transfer fails
        }
    }

    // ── Step 1+: Execute LI.FI bridge routes ─────────────────────────────
    for (let i = 0; i < plan.sources.length; i++) {
        const source = plan.sources[i]

        onUpdate({ sourceIndex: i, status: 'approving', substep: `Preparing ${source.token} on ${source.chainName}…` })

        try {
            const provider = await getProvider()

            const accounts: string[] = await provider.request({ method: 'eth_accounts' })
            if (!accounts?.[0]) throw new Error('No connected wallet account found.')

            const startChainId = source.route.fromChainId
            _rawProvider = provider
            _sourceChain = VIEM_CHAINS[startChainId] ?? arbitrum
            _walletAddress = accounts[0] as `0x${string}`

            await executeRoute(source.route, {
                updateRouteHook(updatedRoute: Route) {
                    const route = updatedRoute as any

                    // Walk through every step+process to find the most relevant status
                    for (const step of (route.steps ?? [])) {
                        const processes = step.execution?.process ?? []
                        for (const proc of processes) {
                            const procLabel = PROCESS_LABELS[proc.type] ?? proc.type
                            const token = step.action?.fromToken?.symbol ?? source.token
                            const chain = step.action?.fromToken?.chainId
                                ? SUPPORTED_CHAINS.find(c => c.id === step.action.fromToken.chainId)?.name ?? source.chainName
                                : source.chainName

                            if (proc.status === 'ACTION_REQUIRED' || proc.status === 'MESSAGE_REQUIRED') {
                                onUpdate({
                                    sourceIndex: i,
                                    status: 'approving',
                                    substep: `${procLabel} ${token} on ${chain}…`,
                                    txHash: proc.txHash,
                                    txLink: proc.txLink,
                                })
                                return
                            }
                            if (proc.status === 'PENDING') {
                                const isBridge = proc.type === 'CROSS_CHAIN' || proc.type === 'RECEIVING_CHAIN'
                                onUpdate({
                                    sourceIndex: i,
                                    status: isBridge ? 'bridging' : 'swapping',
                                    substep: `${procLabel}…`,
                                    txHash: proc.txHash,
                                    txLink: proc.txLink,
                                })
                                return
                            }
                        }
                    }
                },
            })

            onUpdate({ sourceIndex: i, status: 'done', substep: 'Complete!' })
        } catch (err: any) {
            console.error('[LiFiService] Route execution failed:', err)
            onUpdate({ sourceIndex: i, status: 'failed', substep: 'Execution failed', error: err?.message ?? 'Unknown error' })
        }
    }
}
