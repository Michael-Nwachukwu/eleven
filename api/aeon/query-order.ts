import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

const AEON_SANDBOX_URL = 'https://ai-api-sbx.aeon.xyz'
const AEON_PRODUCTION_URL = 'https://ai-api.aeon.xyz'
const SANDBOX_SECRET = '9999'

/**
 * Generate sign for query order
 * Sign=Y: appId, merchantOrderNo
 * Sign=N: sign
 */
function generateSign(params: Record<string, any>, secret: string): string {
    const flatParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(params)) {
        if (k === 'sign' || k === 'key') continue
        if (v === null || v === undefined || v === '') continue
        flatParams[k] = String(v).trim()
    }
    const sortedKeys = Object.keys(flatParams).sort()
    const signString = sortedKeys.map(k => `${k}=${flatParams[k]}`).join('&') + `&key=${secret}`
    return createHash('sha512').update(signString, 'utf8').digest('hex').toUpperCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const { appId, merchantOrderNo } = req.body
        const baseUrl = appId === 'TEST000001' ? AEON_SANDBOX_URL : AEON_PRODUCTION_URL
        const secret = process.env.AEON_SECRET || SANDBOX_SECRET

        const params = { appId, merchantOrderNo }
        const sign = generateSign(params, secret)

        const response = await fetch(`${baseUrl}/open/api/payment/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...params, sign }),
        })

        const data = await response.json()
        return res.status(200).json(data)
    } catch (error: any) {
        console.error('Aeon query-order proxy error:', error)
        return res.status(500).json({ error: 'Failed to query order', message: error.message })
    }
}
