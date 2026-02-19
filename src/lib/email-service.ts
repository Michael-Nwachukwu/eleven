import { Resend } from 'resend'
import { render } from '@react-email/components'
import { PaymentReceiptEmail } from '../emails/receipt'
import { MerchantAlertEmail } from '../emails/merchant-alert'

const resend = new Resend(process.env.RESEND_API_KEY)
// Use a real domain in production. In sandbox/dev, Resend allows onboarding@resend.dev
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Eleven <onboarding@resend.dev>'

export interface SendReceiptOptions {
    payerEmail?: string
    payerName?: string
    merchantEmail?: string
    amount: string
    currency: string
    orderId: string
    description: string
    mode: 'crypto' | 'fiat'
    merchantName?: string
    explorerUrl?: string
    totalFulfilled: number
    date?: string
}

export interface SendReceiptResult {
    payerSent: boolean
    merchantSent: boolean
    payerError?: string
    merchantError?: string
}

export const EmailService = {
    async sendPaymentReceipt(opts: SendReceiptOptions): Promise<SendReceiptResult> {
        const date = opts.date || new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
        })

        if (!process.env.RESEND_API_KEY) {
            console.error('[EmailService] RESEND_API_KEY is not set — emails will not be sent')
            return { payerSent: false, merchantSent: false, payerError: 'API key not set', merchantError: 'API key not set' }
        }

        let payerSent = false
        let merchantSent = false
        let payerError: string | undefined
        let merchantError: string | undefined

        // 1. Send receipt to the payer
        if (opts.payerEmail) {
            try {
                const html = await render(PaymentReceiptEmail({
                    payerName: opts.payerName || 'Customer',
                    amount: opts.amount,
                    currency: opts.currency,
                    orderId: opts.orderId,
                    description: opts.description,
                    merchantName: opts.merchantName || 'Merchant',
                    date,
                    explorerUrl: opts.explorerUrl,
                    mode: opts.mode,
                }))

                const { data, error } = await resend.emails.send({
                    from: FROM_EMAIL,
                    to: opts.payerEmail,
                    subject: `Payment Receipt – ${opts.description}`,
                    html,
                })
                if (error) {
                    console.error('[EmailService] Resend payer error:', JSON.stringify(error))
                    payerError = error.message || JSON.stringify(error)
                } else {
                    payerSent = true
                    console.log('[EmailService] Payer receipt sent to:', opts.payerEmail, '| id:', data?.id)
                }
            } catch (err: any) {
                console.error('[EmailService] Failed to send payer receipt:', err?.message || err)
                payerError = err?.message || 'Unknown error'
            }
        } else {
            console.log('[EmailService] No payer email provided — skipping payer receipt')
            payerError = 'No payer email provided'
        }

        // 2. Send notification to the merchant
        if (opts.merchantEmail) {
            try {
                const html = await render(MerchantAlertEmail({
                    payerName: opts.payerName || 'Anonymous',
                    payerEmail: opts.payerEmail,
                    amount: opts.amount,
                    currency: opts.currency,
                    orderId: opts.orderId,
                    description: opts.description,
                    date,
                    totalPaid: opts.totalFulfilled,
                }))

                const { data, error } = await resend.emails.send({
                    from: FROM_EMAIL,
                    to: opts.merchantEmail,
                    subject: `💰 New Payment – ${opts.amount} ${opts.currency} received`,
                    html,
                })
                if (error) {
                    console.error('[EmailService] Resend merchant error:', JSON.stringify(error))
                    merchantError = error.message || JSON.stringify(error)
                } else {
                    merchantSent = true
                    console.log('[EmailService] Merchant alert sent to:', opts.merchantEmail, '| id:', data?.id)
                }
            } catch (err: any) {
                console.error('[EmailService] Failed to send merchant alert:', err?.message || err)
                merchantError = err?.message || 'Unknown error'
            }
        } else {
            console.log('[EmailService] No merchant notification email set — skipping merchant alert')
            merchantError = 'No merchant email set'
        }

        return { payerSent, merchantSent, payerError, merchantError }
    },
}
