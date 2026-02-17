import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { X402PaymentRequest } from '../../src/lib/x402'

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
        const { getDecryptedPrivateKey, getAgentByUserId, createPayment, updatePaymentStatus } = await import('../../src/lib/db')
        const { executePayment } = await import('../../src/services/payment-service')

        const { userId, paymentRequest } = req.body as {
            userId: string
            paymentRequest: X402PaymentRequest
        }

        if (!userId || !paymentRequest) {
            return res.status(400).json({ error: 'userId and paymentRequest are required' })
        }

        // Get agent wallet
        const agent = await getAgentByUserId(userId)
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' })
        }

        // Get decrypted private key
        const privateKey = await getDecryptedPrivateKey(userId)
        if (!privateKey) {
            return res.status(500).json({ error: 'Failed to decrypt private key' })
        }

        // Determine payment type
        const paymentType = paymentRequest.metadata?.provider === 'aeon' ? 'fiat' : 'crypto'

        // Create payment record
        const payment = await createPayment(
            agent.id,
            paymentType,
            paymentRequest.maxAmountRequired,
            paymentRequest.metadata?.token || 'USDC',
            paymentRequest.metadata
        )

        // Execute payment
        const result = await executePayment(paymentRequest, privateKey)

        // Update payment status
        if (result.success && result.transactionHash) {
            await updatePaymentStatus(payment.id, 'completed', result.transactionHash)

            return res.status(200).json({
                success: true,
                paymentId: payment.id,
                transactionHash: result.transactionHash,
                mode: result.mode
            })
        } else {
            await updatePaymentStatus(payment.id, 'failed')

            return res.status(400).json({
                success: false,
                paymentId: payment.id,
                error: result.error
            })
        }

    } catch (error: any) {
        console.error('Error executing payment:', error)
        return res.status(500).json({
            error: 'Failed to execute payment',
            message: error.message
        })
    }
}
