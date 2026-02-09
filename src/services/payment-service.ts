import { AeonX402Client } from './aeon-x402-clientt'
import { getAgentWallet } from './thirdweb-agent-service'
import type { X402PaymentRequest } from '@/lib/x402'
import { prepareContractCall, sendTransaction, getContract } from 'thirdweb'
import { thirdwebClient } from './thirdweb-agent-service'
import { arbitrum } from 'thirdweb/chains'

export interface PaymentResult {
  success: boolean
  transactionHash?: string
  amount?: string
  network: string
  mode: 'aeon' | 'crypto'
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
 * Execute direct crypto-to-crypto payment
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

    // Get user's agent wallet
    const { agentWallet } = await getAgentWallet(agentPrivateKey)

    // Get USDC contract on Arbitrum
    const usdcContract = getContract({
      client: thirdwebClient,
      address: paymentRequest.asset,
      chain: arbitrum, // Use Arbitrum One mainnet
    })

    onProgress?.({
      stage: 'executing',
      message: 'Executing USDC transfer...',
      progress: 60,
    })

    // Prepare transfer transaction
    const transaction = prepareContractCall({
      contract: usdcContract,
      method: 'function transfer(address to, uint256 amount) returns (bool)',
      params: [paymentRequest.payTo, BigInt(paymentRequest.maxAmountRequired)],
    })

    // Send transaction
    const account = agentWallet.getAccount()
    if (!account) {
      throw new Error('Agent wallet account not available')
    }

    const result = await sendTransaction({
      transaction,
      account,
    })

    onProgress?.({
      stage: 'complete',
      message: 'Transfer successful!',
      progress: 100,
    })

    return {
      success: true,
      transactionHash: result.transactionHash,
      amount: paymentRequest.maxAmountRequired,
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
 * Determine payment mode and execute
 */
export async function executePayment(
  paymentRequest: X402PaymentRequest,
  agentPrivateKey: string,
  onProgress?: (progress: PaymentProgress) => void
): Promise<PaymentResult> {
  // Detect payment mode
  const isAeonPayment =
    paymentRequest.metadata?.provider === 'aeon' ||
    paymentRequest.resource?.includes('aeon')

  if (isAeonPayment) {
    return executeAeonPayment(paymentRequest, agentPrivateKey, onProgress)
  } else {
    return executeCryptoPayment(paymentRequest, agentPrivateKey, onProgress)
  }
}
