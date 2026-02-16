import type { VercelRequest, VercelResponse } from '@vercel/node'

const AEON_SANDBOX_URL = 'https://ai-api-sbx.aeon.xyz'
const AEON_PRODUCTION_URL = 'https://ai-api.aeon.xyz'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const { appId, sign, currency, bankCode, accountNumber } = req.body

        const baseUrl = appId === 'TEST000001' ? AEON_SANDBOX_URL : AEON_PRODUCTION_URL

        const response = await fetch(`${baseUrl}/open/api/bankCheck`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId, sign, currency, bankCode, accountNumber }),
        })

        const data = await response.json()
        return res.status(200).json(data)
    } catch (error: any) {
        console.error('Aeon verify proxy error:', error)
        return res.status(500).json({ error: 'Failed to verify account', message: error.message })
    }
}
