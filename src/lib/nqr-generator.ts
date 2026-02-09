/**
 * EMV QR Code Generator for Nigerian NQR Payment System
 * 
 * Based on EMV QCR (Quick Code Response) Specification for Payment Systems
 * Adapted for Nigerian NQR (Nigeria Quick Response) standard
 * 
 * Reference: NIBSS NQR Implementation Guide
 */

// Nigerian Bank Codes (commonly used)
export const NIGERIAN_BANKS: Record<string, { code: string; name: string }> = {
    'access': { code: '044', name: 'Access Bank' },
    'gtbank': { code: '058', name: 'Guaranty Trust Bank' },
    'zenith': { code: '057', name: 'Zenith Bank' },
    'uba': { code: '033', name: 'United Bank for Africa' },
    'firstbank': { code: '011', name: 'First Bank of Nigeria' },
    'fcmb': { code: '214', name: 'First City Monument Bank' },
    'stanbic': { code: '221', name: 'Stanbic IBTC Bank' },
    'fidelity': { code: '070', name: 'Fidelity Bank' },
    'sterling': { code: '232', name: 'Sterling Bank' },
    'union': { code: '032', name: 'Union Bank' },
    'wema': { code: '035', name: 'Wema Bank' },
    'polaris': { code: '076', name: 'Polaris Bank' },
    'ecobank': { code: '050', name: 'Ecobank Nigeria' },
    'keystone': { code: '082', name: 'Keystone Bank' },
    'unity': { code: '215', name: 'Unity Bank' },
    'heritage': { code: '030', name: 'Heritage Bank' },
    'jaiz': { code: '301', name: 'Jaiz Bank' },
    'kuda': { code: '50211', name: 'Kuda Microfinance Bank' },
    'opay': { code: '999992', name: 'OPay' },
    'palmpay': { code: '999991', name: 'PalmPay' },
    'moniepoint': { code: '50515', name: 'Moniepoint MFB' },
}

export interface BankAccountDetails {
    bankCode: string          // Bank code (e.g., "044" for Access Bank)
    accountNumber: string     // 10-digit NUBAN account number
    accountName: string       // Account holder name
    amount?: string           // Optional: Amount in NGN (e.g., "10000.00")
    merchantCity?: string     // Optional: City (default: Lagos)
    reference?: string        // Optional: Payment reference
}

/**
 * EMV QR Code Data Object
 * Format: ID (2 chars) + Length (2 chars) + Value
 */
function encodeDataObject(id: string, value: string): string {
    const length = value.length.toString().padStart(2, '0')
    return `${id}${length}${value}`
}

/**
 * Calculate CRC16-CCITT checksum for EMV QR code
 * Polynomial: 0x1021, Initial: 0xFFFF
 */
function calculateCRC16(data: string): string {
    let crc = 0xFFFF
    const polynomial = 0x1021

    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ polynomial) & 0xFFFF
            } else {
                crc = (crc << 1) & 0xFFFF
            }
        }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Generate Nigerian NQR (EMV) QR code string from bank account details
 * 
 * Structure:
 * - ID 00: Payload Format Indicator (fixed "01")
 * - ID 01: Point of Initiation Method (11=static, 12=dynamic)
 * - ID 26-51: Merchant Account Information Template
 * - ID 52: Merchant Category Code
 * - ID 53: Transaction Currency (566 for NGN)
 * - ID 54: Transaction Amount (optional)
 * - ID 58: Country Code (NG)
 * - ID 59: Merchant Name
 * - ID 60: Merchant City
 * - ID 62: Additional Data Field Template
 * - ID 63: CRC (checksum)
 */
export function generateNigerianQRCode(details: BankAccountDetails): string {
    const {
        bankCode,
        accountNumber,
        accountName,
        amount,
        merchantCity = 'Lagos',
        reference
    } = details

    // Validate inputs
    if (!bankCode || bankCode.length < 3) {
        throw new Error('Invalid bank code')
    }
    if (!accountNumber || accountNumber.length !== 10) {
        throw new Error('Account number must be 10 digits')
    }
    if (!accountName || accountName.length === 0) {
        throw new Error('Account name is required')
    }

    // Build the QR code string
    let qrString = ''

    // ID 00: Payload Format Indicator (always "01")
    qrString += encodeDataObject('00', '01')

    // ID 01: Point of Initiation Method
    // "11" = Static QR (reusable, no amount)
    // "12" = Dynamic QR (one-time, with amount)
    qrString += encodeDataObject('01', amount ? '12' : '11')

    // ID 26: Merchant Account Information (Nigerian Bank Transfer)
    // Sub-fields:
    // - 00: Globally Unique Identifier (NQR format)
    // - 01: Bank Code
    // - 02: Account Number
    const merchantAccountInfo =
        encodeDataObject('00', 'NG.NQR') +           // NQR identifier
        encodeDataObject('01', bankCode.padStart(6, '0')) +  // Bank code
        encodeDataObject('02', accountNumber)         // Account number
    qrString += encodeDataObject('26', merchantAccountInfo)

    // ID 52: Merchant Category Code (0000 = default)
    qrString += encodeDataObject('52', '0000')

    // ID 53: Transaction Currency (566 = Nigerian Naira)
    qrString += encodeDataObject('53', '566')

    // ID 54: Transaction Amount (optional)
    if (amount) {
        // Format amount with 2 decimal places
        const formattedAmount = parseFloat(amount).toFixed(2)
        qrString += encodeDataObject('54', formattedAmount)
    }

    // ID 58: Country Code (NG = Nigeria)
    qrString += encodeDataObject('58', 'NG')

    // ID 59: Merchant Name (truncate to 25 chars for EMV compliance)
    const truncatedName = accountName.substring(0, 25).toUpperCase()
    qrString += encodeDataObject('59', truncatedName)

    // ID 60: Merchant City
    qrString += encodeDataObject('60', merchantCity.substring(0, 15))

    // ID 62: Additional Data Field Template (optional reference)
    if (reference) {
        const additionalData = encodeDataObject('05', reference.substring(0, 25)) // Reference label
        qrString += encodeDataObject('62', additionalData)
    }

    // ID 63: CRC (must be last, with placeholder "6304" + 4-char CRC)
    // First add the ID and length (63 + 04), then calculate CRC
    qrString += '6304'
    const crc = calculateCRC16(qrString)
    qrString += crc

    return qrString
}

/**
 * Parse an EMV QR code string to extract bank details
 * Useful for validation and display
 */
export function parseEMVQRCode(qrString: string): Partial<BankAccountDetails> & { currency?: string } {
    const result: Partial<BankAccountDetails> & { currency?: string } = {}
    let position = 0

    while (position < qrString.length - 4) { // -4 for CRC
        const id = qrString.substring(position, position + 2)
        const length = parseInt(qrString.substring(position + 2, position + 4), 10)
        const value = qrString.substring(position + 4, position + 4 + length)
        position += 4 + length

        switch (id) {
            case '26': // Merchant Account Info
                // Parse sub-fields
                let subPos = 0
                while (subPos < value.length) {
                    const subId = value.substring(subPos, subPos + 2)
                    const subLen = parseInt(value.substring(subPos + 2, subPos + 4), 10)
                    const subVal = value.substring(subPos + 4, subPos + 4 + subLen)
                    subPos += 4 + subLen

                    if (subId === '01') result.bankCode = subVal.replace(/^0+/, '')
                    if (subId === '02') result.accountNumber = subVal
                }
                break
            case '53':
                result.currency = value === '566' ? 'NGN' : value
                break
            case '54':
                result.amount = value
                break
            case '59':
                result.accountName = value
                break
            case '60':
                result.merchantCity = value
                break
        }
    }

    return result
}

/**
 * Validate a Nigerian bank account number (NUBAN format)
 */
export function validateNUBAN(bankCode: string, accountNumber: string): boolean {
    if (accountNumber.length !== 10) return false
    if (!/^\d+$/.test(accountNumber)) return false

    // NUBAN checksum algorithm
    const weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]
    const combined = bankCode.padStart(3, '0') + accountNumber

    if (combined.length < 13) return true // Skip validation for fintech codes

    let sum = 0
    for (let i = 0; i < 12; i++) {
        sum += parseInt(combined[i], 10) * weights[i]
    }

    const checkDigit = (10 - (sum % 10)) % 10
    return checkDigit === parseInt(accountNumber[9], 10)
}

/**
 * Get bank info by code
 */
export function getBankByCode(code: string): { code: string; name: string } | undefined {
    return Object.values(NIGERIAN_BANKS).find(b => b.code === code)
}

/**
 * Get all Nigerian banks as array for select dropdown
 */
export function getNigerianBanksList(): Array<{ value: string; label: string; code: string }> {
    return Object.entries(NIGERIAN_BANKS).map(([key, bank]) => ({
        value: key,
        label: bank.name,
        code: bank.code
    }))
}
