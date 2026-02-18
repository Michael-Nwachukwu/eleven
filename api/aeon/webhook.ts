import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Aeon webhook handler — receives order status updates from Aeon
 * Called by Aeon when a bank transfer order status changes
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()

    try {
        const body = req.body
        console.log('=== Aeon Webhook Received ===', JSON.stringify(body, null, 2))

        // Aeon expects a 200 response with "success" to acknowledge receipt
        return res.status(200).json({ success: true })
    } catch (error: any) {
        console.error('Aeon webhook error:', error)
        return res.status(200).json({ success: true }) // Always 200 to prevent Aeon retries
    }
}
