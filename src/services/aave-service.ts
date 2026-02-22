/**
 * Aave V3 Service — Arbitrum
 * Handles USDC supply/withdraw and position reading via Aave V3 Pool.
 */
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction, readContract } from 'thirdweb'
import { defineChain, arbitrum } from 'thirdweb/chains'
import { privateKeyToAccount } from 'thirdweb/wallets'

// ── Addresses (Arbitrum One) ──────────────────────────────────────────────────
const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as `0x${string}`
const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`
const AUSDC_ADDRESS = '0x724dc807b04555b71ed48a6896b6F41593b8C637' as `0x${string}`
const AAVE_DATA_PROVIDER = '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654' as `0x${string}`

const USDC_DECIMALS = 6

// ── ABI fragments ─────────────────────────────────────────────────────────────
const POOL_ABI = [
    {
        name: 'supply',
        type: 'function',
        inputs: [
            { name: 'asset', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'onBehalfOf', type: 'address' },
            { name: 'referralCode', type: 'uint16' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        name: 'withdraw',
        type: 'function',
        inputs: [
            { name: 'asset', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'to', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
    },
] as const

const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
] as const

const DATA_PROVIDER_ABI = [
    {
        name: 'getReserveData',
        type: 'function',
        inputs: [{ name: 'asset', type: 'address' }],
        outputs: [
            { name: 'unbacked', type: 'uint128' },
            { name: 'accruedToTreasuryScaled', type: 'uint128' },
            { name: 'totalAToken', type: 'uint128' },
            { name: 'totalStableDebt', type: 'uint128' },
            { name: 'totalVariableDebt', type: 'uint128' },
            { name: 'liquidityRate', type: 'uint128' },
            { name: 'variableBorrowRate', type: 'uint128' },
            { name: 'stableBorrowRate', type: 'uint128' },
            { name: 'averageStableBorrowRate', type: 'uint128' },
            { name: 'liquidityIndex', type: 'uint128' },
            { name: 'variableBorrowIndex', type: 'uint128' },
            { name: 'lastUpdateTimestamp', type: 'uint40' },
        ],
        stateMutability: 'view',
    },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────
function getClient() {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID
    if (!clientId) throw new Error('THIRDWEB_CLIENT_ID is not set')
    return createThirdwebClient({ clientId })
}

function usdcToAtomicBigInt(amount: number): bigint {
    return BigInt(Math.floor(amount * 10 ** USDC_DECIMALS))
}

function atomicToUsdc(atomic: bigint): number {
    return Number(atomic) / 10 ** USDC_DECIMALS
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AavePosition {
    aUsdcBalance: number   // in USDC units
    liquidityUsd: number   // same (aUSDC 1:1 with USDC principal)
    apy: number            // current supply APY as a percentage, e.g. 1.8
}

/**
 * Returns the agent's current Aave V3 position and live APY.
 */
export async function getAavePosition(agentAddress: string): Promise<AavePosition> {
    const client = getClient()

    const aUsdcContract = getContract({ client, chain: arbitrum, address: AUSDC_ADDRESS, abi: ERC20_ABI })
    const dataProvider = getContract({ client, chain: arbitrum, address: AAVE_DATA_PROVIDER, abi: DATA_PROVIDER_ABI })

    const [rawBalance, reserveData] = await Promise.all([
        readContract({ contract: aUsdcContract, method: 'balanceOf', params: [agentAddress as `0x${string}`] }),
        readContract({ contract: dataProvider, method: 'getReserveData', params: [USDC_ADDRESS] }),
    ])

    const aUsdcBalance = atomicToUsdc(rawBalance)

    // liquidityRate is in Ray units (1e27). Convert to APY%
    // APY% = (liquidityRate / 1e27) * 100
    const RAY = BigInt('1000000000000000000000000000') // 1e27
    const apyRaw = Number((reserveData[5] * BigInt(10000)) / RAY) / 100  // basis points → %
    const apy = Math.round(apyRaw * 100) / 100  // 2 decimal places

    return { aUsdcBalance, liquidityUsd: aUsdcBalance, apy }
}

/**
 * Fetches the current Aave V3 USDC supply APY on Arbitrum.
 */
export async function getAaveAPY(): Promise<number> {
    const pos = await getAavePosition('0x0000000000000000000000000000000000000000')
    return pos.apy
}

/**
 * Supplies USDC to Aave V3 on behalf of the agent.
 */
export async function supplyToAave(
    amountUsdc: number,
    agentPrivateKey: string,
): Promise<string> {
    const client = getClient()
    const account = privateKeyToAccount({ client, privateKey: agentPrivateKey as `0x${string}` })
    const atomicAmount = usdcToAtomicBigInt(amountUsdc)

    const usdcContract = getContract({ client, chain: arbitrum, address: USDC_ADDRESS, abi: ERC20_ABI })
    const aavePool = getContract({ client, chain: arbitrum, address: AAVE_POOL_ADDRESS, abi: POOL_ABI })

    // Step 1: approve Aave Pool to spend USDC
    const approveTx = prepareContractCall({
        contract: usdcContract,
        method: 'approve',
        params: [AAVE_POOL_ADDRESS, atomicAmount],
    })
    await sendTransaction({ transaction: approveTx, account })

    // Step 2: supply to Aave
    const supplyTx = prepareContractCall({
        contract: aavePool,
        method: 'supply',
        params: [USDC_ADDRESS, atomicAmount, account.address, 0],
    })
    const receipt = await sendTransaction({ transaction: supplyTx, account })
    return receipt.transactionHash
}

/**
 * Withdraws USDC from Aave V3 back to the agent's wallet.
 * Pass Infinity (or a very large number) to withdraw the full position.
 */
export async function withdrawFromAave(
    amountUsdc: number,
    agentPrivateKey: string,
): Promise<string> {
    const client = getClient()
    const account = privateKeyToAccount({ client, privateKey: agentPrivateKey as `0x${string}` })

    // Use max uint256 to withdraw everything; otherwise use exact amount
    const atomicAmount = amountUsdc === Infinity
        ? BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
        : usdcToAtomicBigInt(amountUsdc)

    const aavePool = getContract({ client, chain: arbitrum, address: AAVE_POOL_ADDRESS, abi: POOL_ABI })

    const withdrawTx = prepareContractCall({
        contract: aavePool,
        method: 'withdraw',
        params: [USDC_ADDRESS, atomicAmount, account.address],
    })
    const receipt = await sendTransaction({ transaction: withdrawTx, account })
    return receipt.transactionHash
}

/**
 * Called after each successful INCOMING CRYPTO payment.
 * Deposits the configured allocation % of the received amount into Aave,
 * subject to the monthly limit.
 */
export async function autoInvestFromPayment(opts: {
    receivedUsdc: number
    allocationPercent: number    // 0-100
    monthlyLimit: number         // max USDC to invest per month, 0 = unlimited
    monthlyInvested: number      // how much has been invested this month already
    agentPrivateKey: string
}): Promise<{ invested: number; txHash: string | null }> {
    const { receivedUsdc, allocationPercent, monthlyLimit, monthlyInvested, agentPrivateKey } = opts

    if (allocationPercent <= 0) return { invested: 0, txHash: null }

    // How much we'd like to invest
    let toInvest = receivedUsdc * (allocationPercent / 100)

    // Respect monthly limit
    if (monthlyLimit > 0) {
        const remaining = monthlyLimit - monthlyInvested
        if (remaining <= 0) return { invested: 0, txHash: null }
        toInvest = Math.min(toInvest, remaining)
    }

    if (toInvest < 0.01) return { invested: 0, txHash: null }  // dust check

    const txHash = await supplyToAave(toInvest, agentPrivateKey)
    return { invested: toInvest, txHash }
}
