import type { VercelRequest, VercelResponse } from '@vercel/node'

const AEON_SANDBOX_URL = 'https://ai-api-sbx.aeon.xyz'
const AEON_PRODUCTION_URL = 'https://ai-api.aeon.xyz'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT')
    // Expose X-Payment-Response header to the browser
    res.setHeader('Access-Control-Expose-Headers', 'X-Payment-Response')

    if (req.method === 'OPTIONS') return res.status(200).end()

    try {
        const { appId, qrCode, address, sandbox } = req.query
        const useSandbox = sandbox !== 'false'
        const baseUrl = useSandbox ? AEON_SANDBOX_URL : AEON_PRODUCTION_URL

        const url = new URL(`${baseUrl}/open/ai/402/payment`)
        if (appId) url.searchParams.set('appId', appId as string)
        if (qrCode) url.searchParams.set('qrCode', qrCode as string)
        if (address) url.searchParams.set('address', address as string)

        const headers: Record<string, string> = {}

        // Forward X-PAYMENT header if present (for payment submission)
        const xPaymentHeader = req.headers['x-payment'] as string
        if (xPaymentHeader) {
            headers['X-PAYMENT'] = xPaymentHeader
        }

        const response = await fetch(url.toString(), { headers })

        const body = await response.json()

        // Forward X-Payment-Response header if present
        const xPaymentResponse = response.headers.get('X-Payment-Response')
        if (xPaymentResponse) {
            res.setHeader('X-Payment-Response', xPaymentResponse)
        }

        return res.status(response.status).json(body)
    } catch (error: any) {
        console.error('Aeon x402 proxy error:', error)
        return res.status(500).json({ error: 'x402 proxy failed', message: error.message })
    }
}
