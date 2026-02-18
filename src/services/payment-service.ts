import { AeonX402Client } from './aeon-x402-clientt'
import { getAgentWallet } from './thirdweb-agent-service'
import type { X402PaymentRequest } from '@/lib/x402'
import { prepareContractCall, sendTransaction, getContract, waitForReceipt } from 'thirdweb'
import { thirdwebClient } from './thirdweb-agent-service'
import { arbitrum } from 'thirdweb/chains'

// =============================================================================
// Payment Splitter Constants
// =============================================================================

const USDC_DECIMALS = 6
const EXTERNAL_WALLET_FEE_BPS = 250  // 2.5%
const AGENT_WALLET_FEE_BPS = 50     // 0.5%

// Set this after deploying the PaymentSplitter contract
const SPLITTER_ADDRESS = import.meta.env.VITE_SPLITTER_ADDRESS || ''

// ABI selectors for raw encoding (external wallet path)
const APPROVE_SELECTOR = '0x095ea7b3'      // approve(address,uint256)
const SPLIT_PAYMENT_SELECTOR = '0x2cdb5a08' // splitPayment(address,address,uint256,uint256)

export interface PaymentResult {
  success: boolean
  transactionHash?: string
  amount?: string
  fee?: string
  network: string
  mode: 'aeon' | 'crypto' | 'external'
  error?: string
}

export interface PaymentProgress {
  stage: 'checking' | 'bridging' | 'executing' | 'complete' | 'failed'
  message: string
  progress: number
}

/**
 * Execute Aeon fiat settlement payment
 */
export async function executeAeonPayment(
  paymentRequest: X402PaymentRequest,
  agentPrivateKey: string,
  onProgress?: (progress: PaymentProgress) => void
): Promise<PaymentResult> {
  try {
    onProgress?.({
      stage: 'checking',
      message: 'Initializing Aeon payment...',
      progress: 10,
    })

    // Get user's agent wallet
    const { agentWallet } = await getAgentWallet(agentPrivateKey)

    // Initialize Aeon client (use sandbox for testing)
    const aeonClient = new AeonX402Client(true) // Sandbox for testing
    aeonClient.setWallet(agentWallet)

    onProgress?.({
      stage: 'checking',
      message: 'Fetching payment details from Aeon...',
      progress: 30,
    })

    // Get payment info from Aeon (402 response)
    const appId = paymentRequest.metadata?.appId || import.meta.env.VITE_AEON_APP_ID
    const qrCode = paymentRequest.metadata?.qrCode || paymentRequest.resource

    console.log('=== Aeon Payment Request ===')
    console.log('App ID:', appId)
    console.log('QR Code:', qrCode)

    const paymentInfo = await aeonClient.getPaymentInfo(appId, qrCode)

    console.log('=== Aeon Payment Info Response ===')
    console.log('Full Response:', JSON.stringify(paymentInfo, null, 2))

    if (paymentInfo.code !== '402') {
      throw new Error(`Unexpected Aeon response: ${paymentInfo.msg}`)
    }

    // Validate accepts array exists
    if (!paymentInfo.accepts || paymentInfo.accepts.length === 0) {
      throw new Error('Aeon returned no payment options (accepts array is empty)')
    }

    const acceptedPayment = paymentInfo.accepts[0]
    console.log('=== Accepted Payment Details ===')
    console.log('amountRequired:', acceptedPayment.amountRequired)
    console.log('payToAddress:', acceptedPayment.payToAddress)
    console.log('networkId:', acceptedPayment.networkId)
    console.log('tokenAddress:', acceptedPayment.tokenAddress)

    // Validate required fields (check both new and legacy field names)
    const hasAmount = acceptedPayment.amountRequired || acceptedPayment.maxAmountRequired
    const hasPayTo = acceptedPayment.payToAddress || acceptedPayment.payTo

    if (!hasAmount) {
      throw new Error('Aeon response missing payment amount (amountRequired)')
    }
    if (!hasPayTo) {
      throw new Error('Aeon response missing payTo address (payToAddress)')
    }

    onProgress?.({
      stage: 'executing',
      message: 'Creating payment authorization...',
      progress: 60,
    })

    // Create X-PAYMENT header
    console.log('=== Creating X-PAYMENT Header ===')
    const xPaymentHeader = await aeonClient.createXPaymentHeader(
      acceptedPayment
    )
    console.log('X-PAYMENT Header created successfully, length:', xPaymentHeader.length)

    onProgress?.({
      stage: 'executing',
      message: 'Submitting payment to Aeon...',
      progress: 80,
    })

    // Submit payment with X-PAYMENT
    console.log('=== Submitting Payment to Aeon ===')
    const result = await aeonClient.submitPayment(appId, qrCode, xPaymentHeader)
    console.log('=== Aeon Submit Payment Result ===')
    console.log('Status:', result.status)
    console.log('Body:', JSON.stringify(result.body, null, 2))
    console.log('X-Payment-Response:', result.xPaymentResponse)

    if (result.body.code === '0') {
      onProgress?.({
        stage: 'complete',
        message: 'Payment successful!',
        progress: 100,
      })

      return {
        success: true,
        transactionHash: result.body.model?.txHash || result.xPaymentResponse?.txHash,
        amount: acceptedPayment.amountRequired || acceptedPayment.maxAmountRequired,
        network: acceptedPayment.networkId || 'arbitrum',
        mode: 'aeon',
      }
    } else {
      console.error('Aeon payment rejected:', result.body)
      throw new Error(result.body.msg || result.body.error || 'Payment failed')
    }
  } catch (error: any) {
    console.error('Aeon payment error:', error)

    onProgress?.({
      stage: 'failed',
      message: error.message || 'Payment failed',
      progress: 0,
    })

    return {
      success: false,
      network: 'arbitrum',
      mode: 'aeon',
      error: error.message || 'Aeon payment failed',
    }
  }
}

/**
 * Execute direct crypto payment via agent wallet using PaymentSplitter
 */
export async function executeCryptoPayment(
  paymentRequest: X402PaymentRequest,
  agentPrivateKey: string,
  onProgress?: (progress: PaymentProgress) => void
): Promise<PaymentResult> {
  try {
    onProgress?.({
      stage: 'checking',
      message: 'Preparing crypto transfer...',
      progress: 20,
    })

    if (!SPLITTER_ADDRESS) {
      throw new Error('Payment splitter not configured. Set VITE_SPLITTER_ADDRESS in .env')
    }

    // Get user's agent wallet
    const { agentWallet } = await getAgentWallet(agentPrivateKey)

    const account = agentWallet.getAccount()
    if (!account) {
      throw new Error('Agent wallet account not available')
    }

    // Parse amount
    const amountFloat = parseFloat(paymentRequest.maxAmountRequired)
    if (isNaN(amountFloat) || amountFloat <= 0) {
      throw new Error(`Invalid payment amount: ${paymentRequest.maxAmountRequired}`)
    }
    const baseAtomicAmount = BigInt(Math.round(amountFloat * (10 ** USDC_DECIMALS)))
    const feeAtomicAmount = (baseAtomicAmount * BigInt(AGENT_WALLET_FEE_BPS)) / BigInt(10000)
    const totalAtomicAmount = baseAtomicAmount + feeAtomicAmount

    onProgress?.({
      stage: 'executing',
      message: 'Approving USDC spend...',
      progress: 40,
    })

    // Step 1: Approve the splitter to spend USDC
    const usdcContract = getContract({
      client: thirdwebClient,
      address: paymentRequest.asset,
      chain: arbitrum,
    })

    const approveTx = prepareContractCall({
      contract: usdcContract,
      method: 'function approve(address spender, uint256 amount) returns (bool)',
      params: [SPLITTER_ADDRESS, totalAtomicAmount],
    })

    const approveResult = await sendTransaction({ transaction: approveTx, account })
    await waitForReceipt({ client: thirdwebClient, chain: arbitrum, transactionHash: approveResult.transactionHash })

    onProgress?.({
      stage: 'executing',
      message: 'Executing split payment...',
      progress: 70,
    })

    // Step 2: Call splitPayment on the splitter
    const splitterContract = getContract({
      client: thirdwebClient,
      address: SPLITTER_ADDRESS,
      chain: arbitrum,
    })

    const splitTx = prepareContractCall({
      contract: splitterContract,
      method: 'function splitPayment(address token, address recipient, uint256 amount, uint256 feeBps)',
      params: [paymentRequest.asset, paymentRequest.payTo, baseAtomicAmount, BigInt(AGENT_WALLET_FEE_BPS)],
    })

    const result = await sendTransaction({ transaction: splitTx, account })

    onProgress?.({
      stage: 'complete',
      message: 'Transfer successful!',
      progress: 100,
    })

    const feeFloat = Number(feeAtomicAmount) / (10 ** USDC_DECIMALS)

    return {
      success: true,
      transactionHash: result.transactionHash,
      amount: paymentRequest.maxAmountRequired,
      fee: feeFloat.toFixed(USDC_DECIMALS),
      network: 'arbitrum',
      mode: 'crypto',
    }
  } catch (error: any) {
    console.error('Crypto payment error:', error)

    onProgress?.({
      stage: 'failed',
      message: error.message || 'Transfer failed',
      progress: 0,
    })

    return {
      success: false,
      network: 'arbitrum',
      mode: 'crypto',
      error: error.message || 'Crypto transfer failed',
    }
  }
}

/**
 * Execute Nigeria Bank Transfer via Aeon
 * Flow: createOrder → get orderNo → x402 payment (same as VND) → poll status
 */
export async function executeNigeriaBankTransfer(
  paymentRequest: X402PaymentRequest,
  agentPrivateKey: string,
  onProgress?: (progress: PaymentProgress) => void
): Promise<PaymentResult> {
  // Import dynamically to avoid issues
  const { getAeonBankTransferClient } = await import('./aeon-bank-transfer')

  try {
    onProgress?.({
      stage: 'checking',
      message: 'Initializing bank transfer...',
      progress: 10,
    })

    // Extract bank details from metadata
    const metadata = paymentRequest.metadata
    if (!metadata?.bankCode || !metadata?.bankName || !metadata?.accountNumber) {
      throw new Error('Missing bank transfer details')
    }

    const amount = metadata.originalAmount || paymentRequest.maxAmountRequired
    const currency = metadata.currency || 'NGN'

    // Get user IP for Aeon API
    const client = getAeonBankTransferClient(true) // Sandbox
    const userIp = await client.getUserIp()

    onProgress?.({
      stage: 'executing',
      message: 'Creating bank transfer order...',
      progress: 30,
    })

    // Step 1: Create the bank transfer order with Aeon
    const orderResult = await client.createOrder({
      amount: amount.toString(),
      currency: currency as 'NGN',
      bankCode: metadata.bankCode,
      bankName: metadata.bankName,
      bankAccountNumber: metadata.accountNumber,
      // userId must be email/phone per Aeon docs — accountName is the bank holder name, not valid here
      userId: 'user@example.com',
      userIp: userIp,
      email: 'user@example.com',
      remark: paymentRequest.description,
    })

    console.log('=== Nigeria Bank Transfer Order Result ===', orderResult)

    if (!orderResult.success || orderResult.code !== '0') {
      throw new Error(orderResult.msg || 'Failed to create bank transfer order')
    }

    const usdcAmount = orderResult.model?.amount
    const orderNo = orderResult.model?.orderNo
    const merchantOrderNo = orderResult.merchantOrderNo

    if (!orderNo) {
      throw new Error('Aeon did not return an order number')
    }

    onProgress?.({
      stage: 'executing',
      message: `Order created (${orderNo}). Executing x402 payment...`,
      progress: 50,
    })

    // Step 2: Execute x402 payment using the same pattern as VND
    const { agentWallet } = await getAgentWallet(agentPrivateKey)
    const aeonClient = new AeonX402Client(true) // Sandbox
    aeonClient.setWallet(agentWallet)

    // Use orderNo as the QR code / identifier for the x402 flow
    const appId = metadata.appId || import.meta.env.VITE_AEON_APP_ID || 'TEST000001'

    // Get payment info from Aeon (402 response)
    const paymentInfo = await aeonClient.getPaymentInfo(appId, orderNo)

    console.log('=== Bank Transfer x402 Payment Info ===', JSON.stringify(paymentInfo, null, 2))

    if (paymentInfo.code !== '402' || !paymentInfo.accepts?.length) {
      // If Aeon doesn't require x402 for this order, treat order creation as success
      console.log('Aeon did not return 402 for bank transfer order, treating order as submitted')
      onProgress?.({
        stage: 'complete',
        message: `Bank transfer order submitted: ${orderNo}`,
        progress: 100,
      })
      return {
        success: true,
        transactionHash: orderNo,
        amount: usdcAmount || amount,
        network: 'arbitrum',
        mode: 'aeon',
      }
    }

    onProgress?.({
      stage: 'executing',
      message: 'Signing x402 payment authorization...',
      progress: 65,
    })

    // Create X-PAYMENT header
    const acceptedPayment = paymentInfo.accepts[0]
    const xPaymentHeader = await aeonClient.createXPaymentHeader(acceptedPayment)

    onProgress?.({
      stage: 'executing',
      message: 'Submitting payment to Aeon...',
      progress: 80,
    })

    // Submit payment with X-PAYMENT
    const result = await aeonClient.submitPayment(appId, orderNo, xPaymentHeader)

    console.log('=== Bank Transfer x402 Submit Result ===', result)

    if (result.body.code === '0') {
      // Step 3: Poll for order completion
      onProgress?.({
        stage: 'executing',
        message: 'Waiting for bank transfer confirmation...',
        progress: 90,
      })

      // Poll a few times for status (test/sandbox should resolve quickly)
      let finalStatus = 'PENDING'
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        try {
          const statusResult = await client.queryOrder(merchantOrderNo || orderNo)
          finalStatus = statusResult.model?.status || 'PENDING'
          console.log(`Poll ${i + 1}: Order ${orderNo} status = ${finalStatus}`)
          if (finalStatus === 'SUCCESS' || finalStatus === 'FAILED') break
        } catch (err) {
          console.warn('Poll error:', err)
        }
      }

      onProgress?.({
        stage: 'complete',
        message: `Bank transfer ${finalStatus === 'SUCCESS' ? 'completed' : 'submitted'}: ${orderNo}`,
        progress: 100,
      })

      return {
        success: true,
        transactionHash: result.body.model?.txHash || orderNo,
        amount: usdcAmount || amount,
        network: 'arbitrum',
        mode: 'aeon',
      }
    } else {
      throw new Error(result.body.msg || result.body.error || 'Aeon x402 payment failed')
    }

  } catch (error: any) {
    console.error('Nigeria bank transfer error:', error)

    onProgress?.({
      stage: 'failed',
      message: error.message || 'Bank transfer failed',
      progress: 0,
    })

    return {
      success: false,
      network: 'arbitrum',
      mode: 'aeon',
      error: error.message || 'Nigeria bank transfer failed',
    }
  }
}

/**
 * Determine payment mode and execute
 */
export async function executePayment(
  paymentRequest: X402PaymentRequest,
  agentPrivateKey: string,
  onProgress?: (progress: PaymentProgress) => void
): Promise<PaymentResult> {
  // Detect payment mode
  const provider = paymentRequest.metadata?.provider

  if (provider === 'aeon-bank-transfer') {
    // Nigeria bank transfer via Aeon
    return executeNigeriaBankTransfer(paymentRequest, agentPrivateKey, onProgress)
  } else if (provider === 'aeon' || paymentRequest.resource?.includes('aeon')) {
    // Legacy Aeon x402 payment (VietQR, etc.)
    return executeAeonPayment(paymentRequest, agentPrivateKey, onProgress)
  } else {
    // Direct crypto payment
    return executeCryptoPayment(paymentRequest, agentPrivateKey, onProgress)
  }
}

// =============================================================================
// EXTERNAL WALLET PAYMENT (via PaymentSplitter with 2.5% fee)
// =============================================================================

/**
 * Helper: pad a hex value to 32 bytes (64 hex chars)
 */
function padHex(value: string, length = 64): string {
  return value.replace('0x', '').padStart(length, '0')
}

/**
 * Execute payment using user's connected external wallet via PaymentSplitter.
 * Two transactions: (1) approve splitter, (2) call splitPayment.
 */
export async function executeExternalWalletPayment(
  paymentRequest: X402PaymentRequest,
  walletProvider: any,
  walletAddress: string,
  onProgress?: (progress: PaymentProgress) => void
): Promise<PaymentResult> {
  try {
    if (!SPLITTER_ADDRESS) {
      throw new Error('Payment splitter not configured. Set VITE_SPLITTER_ADDRESS in .env')
    }

    onProgress?.({
      stage: 'checking',
      message: 'Preparing payment...',
      progress: 10,
    })

    // Calculate amounts
    const baseAmount = parseFloat(paymentRequest.maxAmountRequired)
    if (isNaN(baseAmount) || baseAmount <= 0) {
      throw new Error(`Invalid payment amount: ${paymentRequest.maxAmountRequired}`)
    }

    const feeAmount = baseAmount * (EXTERNAL_WALLET_FEE_BPS / 10000)
    const totalAmount = baseAmount + feeAmount
    const baseAtomicAmount = BigInt(Math.round(baseAmount * (10 ** USDC_DECIMALS)))
    const totalAtomicAmount = BigInt(Math.round(totalAmount * (10 ** USDC_DECIMALS)))

    onProgress?.({
      stage: 'executing',
      message: 'Approve USDC spend in your wallet...',
      progress: 30,
    })

    // Step 1: Approve the splitter to spend USDC
    const approveData = `${APPROVE_SELECTOR}${padHex(SPLITTER_ADDRESS.slice(2))}${padHex(totalAtomicAmount.toString(16))}`

    await walletProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: paymentRequest.asset, // USDC contract
        data: approveData,
        value: '0x0',
      }],
    })

    // Brief wait for approval to confirm
    await new Promise(resolve => setTimeout(resolve, 3000))

    onProgress?.({
      stage: 'executing',
      message: 'Confirm the payment in your wallet...',
      progress: 60,
    })

    // Step 2: Call splitPayment on the splitter
    // splitPayment(address token, address recipient, uint256 amount, uint256 feeBps)
    const splitData = `${SPLIT_PAYMENT_SELECTOR}${padHex(paymentRequest.asset.slice(2))}${padHex(paymentRequest.payTo.slice(2))}${padHex(baseAtomicAmount.toString(16))}${padHex(BigInt(EXTERNAL_WALLET_FEE_BPS).toString(16))}`

    const txHash = await walletProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: SPLITTER_ADDRESS,
        data: splitData,
        value: '0x0',
      }],
    })

    onProgress?.({
      stage: 'complete',
      message: 'Payment sent successfully!',
      progress: 100,
    })

    return {
      success: true,
      transactionHash: txHash,
      amount: baseAmount.toFixed(USDC_DECIMALS),
      fee: feeAmount.toFixed(USDC_DECIMALS),
      network: 'arbitrum',
      mode: 'external',
    }
  } catch (error: any) {
    console.error('External wallet payment error:', error)

    onProgress?.({
      stage: 'failed',
      message: error.message || 'External wallet payment failed',
      progress: 0,
    })

    return {
      success: false,
      network: 'arbitrum',
      mode: 'external',
      error: error.message || 'External wallet payment failed',
    }
  }
}
