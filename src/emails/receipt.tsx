import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Preview,
    Row,
    Column,
    Section,
    Text,
} from '@react-email/components'
import * as React from 'react'

interface PaymentReceiptEmailProps {
    payerName?: string
    amount: string
    currency: string
    orderId: string
    description: string
    merchantName?: string
    date: string
    explorerUrl?: string
    mode: 'crypto' | 'fiat'
}

export function PaymentReceiptEmail({
    payerName = 'Customer',
    amount,
    currency,
    orderId,
    description,
    merchantName = 'Merchant',
    date,
    explorerUrl,
    mode,
}: PaymentReceiptEmailProps) {
    const currencySymbol = currency === 'NGN' ? '₦' : currency === 'VND' ? '₫' : currency === 'USDC' ? '$' : ''
    const previewText = `Your payment of ${currencySymbol}${amount} ${currency} is confirmed`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Header */}
                    <Section style={header}>
                        <Heading style={headerTitle}>Eleven</Heading>
                        <Text style={headerSubtitle}>Payment Receipt</Text>
                    </Section>

                    {/* Success Badge */}
                    <Section style={successSection}>
                        <Text style={successIcon}>✅</Text>
                        <Heading style={successTitle}>Payment Confirmed</Heading>
                        <Text style={successSubtitle}>
                            Hi {payerName}, your payment was processed successfully.
                        </Text>
                    </Section>

                    {/* Amount Box */}
                    <Section style={amountBox}>
                        <Text style={amountLabel}>Amount Paid</Text>
                        <Heading style={amountValue}>
                            {currencySymbol}{Number(amount).toLocaleString()} {currency}
                        </Heading>
                    </Section>

                    {/* Detail Rows */}
                    <Section style={detailsSection}>
                        <Row style={detailRow}>
                            <Column style={detailLabel}>To</Column>
                            <Column style={detailValue}>{merchantName}</Column>
                        </Row>
                        <Hr style={divider} />
                        <Row style={detailRow}>
                            <Column style={detailLabel}>For</Column>
                            <Column style={detailValue}>{description}</Column>
                        </Row>
                        <Hr style={divider} />
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Date</Column>
                            <Column style={detailValue}>{date}</Column>
                        </Row>
                        <Hr style={divider} />
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Order ID</Column>
                            <Column style={{ ...detailValue, fontFamily: 'monospace', fontSize: '11px' }}>
                                {orderId}
                            </Column>
                        </Row>
                        {mode === 'crypto' && (
                            <>
                                <Hr style={divider} />
                                <Row style={detailRow}>
                                    <Column style={detailLabel}>Network</Column>
                                    <Column style={detailValue}>Arbitrum</Column>
                                </Row>
                            </>
                        )}
                    </Section>

                    {/* Explorer Link */}
                    {explorerUrl && (
                        <Section style={{ textAlign: 'center', marginTop: '24px' }}>
                            <Button href={explorerUrl} style={button}>
                                View on Block Explorer
                            </Button>
                        </Section>
                    )}

                    {/* Footer */}
                    <Hr style={footerDivider} />
                    <Text style={footer}>
                        This is an automated receipt from Eleven. If you have questions, contact the merchant directly.
                    </Text>
                </Container>
            </Body>
        </Html>
    )
}

// Styles
const main = {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
    backgroundColor: '#ffffff',
    margin: '40px auto',
    padding: '0',
    borderRadius: '12px',
    overflow: 'hidden' as const,
    maxWidth: '560px',
    border: '1px solid #e8ecef',
}

const header = {
    backgroundColor: '#0f172a',
    padding: '28px 40px',
    textAlign: 'center' as const,
}

const headerTitle = {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0',
}

const headerSubtitle = {
    color: '#94a3b8',
    fontSize: '13px',
    margin: '4px 0 0',
}

const successSection = {
    textAlign: 'center' as const,
    padding: '32px 40px 16px',
}

const successIcon = {
    fontSize: '40px',
    margin: '0 0 12px',
}

const successTitle = {
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 8px',
}

const successSubtitle = {
    fontSize: '14px',
    color: '#64748b',
    margin: '0',
}

const amountBox = {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    margin: '0 auto 8px',
    padding: '20px',
    textAlign: 'center' as const,
    width: '80%',
}

const amountLabel = {
    fontSize: '12px',
    color: '#16a34a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontWeight: '600',
    margin: '0 0 4px',
}

const amountValue = {
    fontSize: '32px',
    fontWeight: '700',
    color: '#15803d',
    margin: '0',
}

const detailsSection = {
    padding: '8px 40px 24px',
}

const detailRow = {
    padding: '10px 0',
}

const detailLabel = {
    fontSize: '13px',
    color: '#64748b',
    width: '120px',
    fontWeight: '500',
}

const detailValue = {
    fontSize: '13px',
    color: '#0f172a',
    fontWeight: '500',
    textAlign: 'right' as const,
}

const divider = {
    borderColor: '#f1f5f9',
    margin: '0',
}

const button = {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    padding: '12px 28px',
    textDecoration: 'none',
}

const footerDivider = {
    borderColor: '#e8ecef',
    margin: '0 40px',
}

const footer = {
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center' as const,
    padding: '20px 40px',
    lineHeight: '1.5',
}

export default PaymentReceiptEmail
