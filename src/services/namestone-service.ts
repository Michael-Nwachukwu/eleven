/**
 * NameStone Service
 * Handles registering and managing ENS subdomains off-chain via NameStone's REST API.
 */

const NAMESTONE_API = 'https://namestone.com/api/public_v1'
// Domain must match the one mapped in NameStone dashboard (e.g. 0xkitchens.eth)
const ENS_DOMAIN = process.env.VITE_ENS_DOMAIN || '0xkitchens.eth'

// Helper to get the API Key (throws if missing)
function getApiKey(): string {
    const key = process.env.NAMESTONE_API_KEY
    if (!key) {
        console.warn('NAMESTONE_API_KEY environment variable is not defined.')
    }
    return key || ''
}

export interface TextRecords {
    description?: string
    url?: string
    avatar?: string
    [key: string]: string | undefined
}

/**
 * Registers an ENS subdomain.
 * e.g. name="nike" creates "nike.0xkitchens.eth" resolving to the agent's address.
 */
export async function registerEnsSubdomain(
    name: string,
    address: string,
    textRecords?: TextRecords
): Promise<void> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('NameStone API Key missing')

    const response = await fetch(`${NAMESTONE_API}/set-name`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey,
        },
        body: JSON.stringify({
            domain: ENS_DOMAIN,
            name: name.toLowerCase(),
            address: address,
            text_records: textRecords || {
                description: 'Eleven Autonomous Agent'
            },
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('NameStone register error:', response.status, response.statusText, errorText)
        throw new Error(`NameStone API error (${response.status}): ${errorText || response.statusText}`)
    }
}

/**
 * Deletes an ENS subdomain (used if the user changes their name).
 */
export async function deleteEnsSubdomain(name: string): Promise<void> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('NameStone API Key missing')

    const response = await fetch(`${NAMESTONE_API}/delete-name`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey,
        },
        body: JSON.stringify({
            domain: ENS_DOMAIN,
            name: name.toLowerCase(),
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('NameStone delete error:', errorText)
        throw new Error(`Failed to delete ENS name: ${response.statusText}`)
    }
}

/**
 * Resolves a subdomain to its details via NameStone API.
 * This is primarily for verification/internal use.
 * Regular wallets resolve it via the CCIP-Read smart contract directly.
 */
export async function resolveEnsSubdomain(name: string): Promise<{ address: string; text_records: any } | null> {
    const apiKey = getApiKey()
    if (!apiKey) return null

    const response = await fetch(`${NAMESTONE_API}/get-names?domain=${ENS_DOMAIN}&name=${name.toLowerCase()}`, {
        method: 'GET',
        headers: {
            'Authorization': apiKey,
        },
    })

    if (!response.ok) {
        return null
    }

    const data = await response.json()
    // get-names returns an array of matching names
    if (Array.isArray(data) && data.length > 0) {
        return data[0]
    }

    return null
}
