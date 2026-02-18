import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

const AEON_SANDBOX_URL = 'https://ai-api-sbx.aeon.xyz'
const AEON_PRODUCTION_URL = 'https://ai-api.aeon.xyz'
const SANDBOX_SECRET = '9999'

/**
 * Generate Aeon SHA-512 signature per docs:
 * 1. Flatten nested objects (bankParam → bankCode, bankName, bankAccountNumber)
 * 2. Exclude fields with Sign=N: sign, email, bankParam (object), customParam, remark
 * 3. Exclude empty/null values
 * 4. Sort by key ascending (ASCII)
 * 5. Concatenate as key=value& then append key=<secret>
 * 6. SHA-512 → uppercase hex
 */
function generateSign(params: Record<string, any>, secret: string): string {
    const SIGN_EXCLUDE = new Set(['sign', 'email', 'customParam', 'remark'])
    const flatParams: Record<string, string> = {}

    for (const [k, v] of Object.entries(params)) {
        if (v === null || v === undefined || v === '') continue

        if (typeof v === 'object' && !Array.isArray(v)) {
            // Flatten nested objects — inner fields like bankCode, bankName, bankAccountNumber ARE Sign=Y
            for (const [nk, nv] of Object.entries(v as Record<string, any>)) {
                if (nv !== null && nv !== undefined && nv !== '') {
                    flatParams[nk] = String(nv).trim()
                }
            }
        } else if (!SIGN_EXCLUDE.has(k)) {
            flatParams[k] = String(v).trim()
        }
    }

    // Sort by key ascending
    const sortedKeys = Object.keys(flatParams).sort()

    // Build signature string: key=value& separated, then key=<secret>
    const signString = sortedKeys.map(k => `${k}=${flatParams[k]}`).join('&') + `&key=${secret}`

    console.log('=== Server-Side Sign String ===', signString)

    // SHA-512 hash
    const hash = createHash('sha512').update(signString, 'utf8').digest('hex').toUpperCase()
    console.log('=== Generated Sign ===', hash)

    return hash
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const {
            appId, merchantOrderNo, amount, currency,
            feeType, userId, userIp, email, callbackUrl,
            bankParam, customParam, remark
        } = req.body

        const isSandbox = appId === 'TEST000001'
        const baseUrl = isSandbox ? AEON_SANDBOX_URL : AEON_PRODUCTION_URL
        const secret = process.env.AEON_SECRET || SANDBOX_SECRET

        // Build the payload WITHOUT sign first
        const params: Record<string, any> = {
            appId,
            merchantOrderNo,
            amount,
            currency,
            feeType,
            userId,
            userIp,
            email,
            callbackUrl,
        }
        if (bankParam) params.bankParam = bankParam
        if (customParam) params.customParam = customParam
        if (remark) params.remark = remark

        // Generate sign server-side
        const sign = generateSign(params, secret)

        // Build final payload WITH sign
        const payload = { ...params, sign }

        console.log('Forwarding to Aeon:', JSON.stringify(payload))

        const response = await fetch(`${baseUrl}/open/api/transfer/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        const data = await response.json()
        console.log('Aeon Response:', JSON.stringify(data))
        return res.status(200).json(data)
    } catch (error: any) {
        console.error('Aeon create-order proxy error:', error)
        return res.status(500).json({ error: 'Failed to create order', message: error.message })
    }
}
