/**
 * Aeon Bank Transfer Service
 * 
 * Handles Nigeria bank transfers via Aeon's Native API Integration
 * https://aeon-xyz.readme.io/docs/bank-transfer-create-order
 * 
 * All API calls go through /api/aeon/* proxy routes to avoid CORS.
 * Supports: NGN (Nigerian Naira) with bank account details
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Proxy routes (Vercel serverless functions that forward to Aeon)
const PROXY_BANKS = '/api/aeon/banks'
const PROXY_VERIFY = '/api/aeon/verify'
const PROXY_CREATE_ORDER = '/api/aeon/create-order'
const PROXY_QUERY_ORDER = '/api/aeon/query-order'

// Sandbox credentials - replace with real credentials for production
// Aeon sandbox secret key (from Aeon docs signature example)
const SANDBOX_SECRET = '9999'

// =============================================================================
// TYPES
// =============================================================================

export interface Bank {
    bankCode: string
    bankName: string
}

export interface AccountFormResponse {
    code: string
    msg: string
    success: boolean
    error: boolean
    traceId: string
    model?: {
        fields: Array<{
            fieldName: string
            formElement: string
            dataSourceKey: string
            length: string
            fieldType: string
            regex: string
        }>
        dataSource: {
            bankList: Bank[]
        }
    }
}

export interface BankAccountCheckResponse {
    code: string
    msg: string
    success: boolean
    error: boolean
    traceId: string
    model?: {
        bankId: string | null
        phoneNumber: string | null
        accountName: string | null
        accountNumber: string | null
    }
}

export interface CreateOrderRequest {
    amount: string
    currency: 'NGN'
    bankCode: string
    bankName: string
    bankAccountNumber: string
    userId: string // Email or phone
    userIp: string
    email?: string
    callbackUrl?: string
    remark?: string
}

export interface CreateOrderResponse {
    code: string
    msg: string
    success: boolean
    error: boolean
    traceId: string
    model?: {
        amount: string // USDC amount to pay
        orderNo: string
    }
    merchantOrderNo?: string // Set by client for polling
}

export interface QueryOrderResponse {
    code: string
    msg: string
    success: boolean
    error: boolean
    traceId: string
    model?: {
        orderNo: string
        merchantOrderNo: string
        status: string // PENDING, SUCCESS, FAILED
        amount: string
        currency: string
        createTime: string
        updateTime: string
    }
}

// =============================================================================
// AEON BANK TRANSFER CLIENT
// =============================================================================

export class AeonBankTransferClient {
    private appId: string
    private secret: string

    constructor(_useSandbox: boolean = true) {
        this.appId = import.meta.env.VITE_AEON_APP_ID || 'TEST000001'
        this.secret = import.meta.env.VITE_AEON_SECRET || SANDBOX_SECRET
    }

    /**
     * Set API secret for production use
     */
    setSecret(secret: string) {
        this.secret = secret
    }

    /**
     * Generate request signature.
     *
     * Sandbox: sign = appId (literal, e.g. "TEST000001") — per Aeon docs examples
     * Production: SHA-512 of sorted params + key=<secret>
     */
    private async generateSign(params: Record<string, any>, excludeKeys: string[] = []): Promise<string> {
        const isSandbox = !import.meta.env.VITE_AEON_SECRET

        if (isSandbox) {
            // Sandbox: sign is literally the appId value (matches all Aeon docs examples)
            return this.appId
        }

        // Production: SHA-512 per Aeon signature description docs
        const skipKeys = new Set(['sign', 'key', ...excludeKeys])
        const flatParams: Record<string, string> = {}

        for (const [k, v] of Object.entries(params)) {
            if (v === null || v === undefined || v === '') continue
            if (typeof v === 'object' && !Array.isArray(v)) {
                for (const [nk, nv] of Object.entries(v)) {
                    if (skipKeys.has(nk)) continue
                    if (nv !== null && nv !== undefined && nv !== '') {
                        flatParams[nk] = String(nv).trim()
                    }
                }
            } else {
                if (skipKeys.has(k)) continue
                flatParams[k] = String(v).trim()
            }
        }

        const sortedKeys = Object.keys(flatParams).sort()
        const signString = sortedKeys.map(k => `${k}=${flatParams[k]}`).join('&') + `&key=${this.secret}`

        console.log('=== Aeon Sign String ===', signString)

        const encoder = new TextEncoder()
        const data = encoder.encode(signString)
        const hashBuffer = await crypto.subtle.digest('SHA-512', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    }

    /**
     * Get Account Form - Fetches list of Nigerian banks
     * Proxied through /api/aeon/banks
     */
    async getAccountForm(currency: 'NGN' = 'NGN'): Promise<AccountFormResponse> {
        const params = { appId: this.appId, currency }

        const response = await fetch(PROXY_BANKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })

        const data = await response.json()
        console.log('=== Aeon Get Account Form Response ===', data)
        return data as AccountFormResponse
    }

    /**
     * Verify Bank Account - Checks if account exists and returns account name
     * Proxied through /api/aeon/verify
     */
    async verifyBankAccount(
        bankCode: string,
        accountNumber: string,
        currency: 'NGN' = 'NGN'
    ): Promise<BankAccountCheckResponse> {
        const params = { appId: this.appId, currency, bankCode, accountNumber }

        const response = await fetch(PROXY_VERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })

        const data = await response.json()
        console.log('=== Aeon Bank Account Check Response ===', data)
        return data as BankAccountCheckResponse
    }

    /**
     * Create Bank Transfer Order - Creates payment order for NGN
     * POST /open/api/transfer/payment
     *
     * Returns the USDC amount that needs to be paid
     * NOTE: Sign is generated server-side by the proxy
     */
    async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
        // Use numeric-only order number to match Aeon docs example format
        const merchantOrderNo = `${Date.now()}${Math.floor(Math.random() * 10000)}`

        const params: Record<string, any> = {
            appId: this.appId,
            merchantOrderNo,
            amount: request.amount,
            currency: request.currency,
            feeType: 'INNER_BUCKLE',
            userId: (request.userId || '').trim(),
            userIp: request.userIp,
            email: request.email || request.userId,
            callbackUrl: request.callbackUrl || `${window.location.origin}/api/aeon/webhook`,
            bankParam: {
                bankCode: request.bankCode,
                bankName: request.bankName,
                bankAccountNumber: request.bankAccountNumber,
            },
        }

        console.log('=== Aeon Create Order Request ===', params)

        // Sign is generated server-side by the proxy
        const response = await fetch(PROXY_CREATE_ORDER, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        })

        const data = await response.json()
        console.log('=== Aeon Create Order Response ===', data)
        // Inject merchantOrderNo so caller can use it for queryOrder polling
        return { ...(data as Record<string, unknown>), merchantOrderNo } as CreateOrderResponse
    }

    /**
     * Query Order Status — sign generated server-side
     */
    async queryOrder(merchantOrderNo: string): Promise<QueryOrderResponse> {
        const params = { appId: this.appId, merchantOrderNo }

        const response = await fetch(PROXY_QUERY_ORDER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })

        const data = await response.json()
        console.log('=== Aeon Query Order Response ===', data)
        return data as QueryOrderResponse
    }

    /**
     * Get user's IP address
     */
    async getUserIp(): Promise<string> {
        try {
            const response = await fetch('https://api.ipify.org?format=json')
            const data = await response.json()
            return data.ip
        } catch {
            return '127.0.0.1'
        }
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let bankTransferClient: AeonBankTransferClient | null = null

export function getAeonBankTransferClient(useSandbox: boolean = true): AeonBankTransferClient {
    if (!bankTransferClient) {
        bankTransferClient = new AeonBankTransferClient(useSandbox)
    }
    return bankTransferClient
}

// =============================================================================
// FALLBACK BANKS (used if Aeon API fails)
// =============================================================================

export const FALLBACK_NIGERIAN_BANKS: Bank[] = [
    { bankCode: '044', bankName: 'Access Bank' },
    { bankCode: '023', bankName: 'Citibank Nigeria' },
    { bankCode: '050', bankName: 'Ecobank Nigeria' },
    { bankCode: '084', bankName: 'Enterprise Bank' },
    { bankCode: '070', bankName: 'Fidelity Bank' },
    { bankCode: '011', bankName: 'First Bank of Nigeria' },
    { bankCode: '214', bankName: 'First City Monument Bank' },
    { bankCode: '058', bankName: 'Guaranty Trust Bank' },
    { bankCode: '030', bankName: 'Heritage Bank' },
    { bankCode: '301', bankName: 'Jaiz Bank' },
    { bankCode: '082', bankName: 'Keystone Bank' },
    { bankCode: '526', bankName: 'Parallex Bank' },
    { bankCode: '076', bankName: 'Polaris Bank' },
    { bankCode: '101', bankName: 'Providus Bank' },
    { bankCode: '221', bankName: 'Stanbic IBTC Bank' },
    { bankCode: '068', bankName: 'Standard Chartered Bank' },
    { bankCode: '232', bankName: 'Sterling Bank' },
    { bankCode: '100', bankName: 'Suntrust Bank' },
    { bankCode: '032', bankName: 'Union Bank of Nigeria' },
    { bankCode: '033', bankName: 'United Bank for Africa' },
    { bankCode: '215', bankName: 'Unity Bank' },
    { bankCode: '035', bankName: 'Wema Bank' },
    { bankCode: '057', bankName: 'Zenith Bank' },
    { bankCode: '999992', bankName: 'Opay' },
    { bankCode: '100039', bankName: 'Paystack-Titan' },
    { bankCode: '999991', bankName: 'PalmPay' },
]
