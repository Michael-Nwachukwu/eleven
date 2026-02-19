import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Row,
    Column,
    Section,
    Text,
    Img,
} from '@react-email/components'
import * as React from 'react'

interface MerchantAlertEmailProps {
    payerName?: string
    payerEmail?: string
    amount: string
    currency: string
    orderId: string
    description: string
    date: string
    totalPaid: number
}

export function MerchantAlertEmail({
    payerName = 'Anonymous',
    payerEmail,
    amount,
    currency,
    orderId,
    description,
    date,
    totalPaid,
}: MerchantAlertEmailProps) {
    const currencySymbol = currency === 'NGN' ? '₦' : currency === 'VND' ? '₫' : currency === 'USDC' ? '$' : ''
    const previewText = `💰 New payment: ${currencySymbol}${amount} ${currency} — ${description}`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Header */}
                    <Section style={header}>
                        <Img
                            src="https://collection.cloudinary.com/daujfmxub/d393a0fb326fee89b222e5b1a24fdc28"
                            alt="Eleven"
                            width="120"
                            height="40"
                            style={{
                                objectFit: 'contain',
                                marginBottom: '8px',
                            }}
                        />
                        <Text style={headerSubtitle}>Payment Notification</Text>
                    </Section>

                    {/* Alert Banner */}
                    <Section style={alertSection}>
                        <Text style={alertIcon}>💰</Text>
                        <Heading style={alertTitle}>New Payment Received</Heading>
                        <Text style={alertSubtitle}>Someone just paid your invoice.</Text>
                    </Section>

                    {/* Amount Box */}
                    <Section style={amountBox}>
                        <Text style={amountLabel}>Amount Received</Text>
                        <Heading style={amountValue}>
                            {currencySymbol}{Number(amount).toLocaleString()} {currency}
                        </Heading>
                    </Section>

                    {/* Detail Rows */}
                    <Section style={detailsSection}>
                        <Row style={detailRow}>
                            <Column style={detailLabel}>From</Column>
                            <Column style={detailValue}>{payerName}</Column>
                        </Row>
                        {payerEmail && (
                            <>
                                <Hr style={divider} />
                                <Row style={detailRow}>
                                    <Column style={detailLabel}>Payer Email</Column>
                                    <Column style={detailValue}>{payerEmail}</Column>
                                </Row>
                            </>
                        )}
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
                            <Column style={detailLabel}>Total Fulfilled</Column>
                            <Column style={detailValue}>{totalPaid} payment{totalPaid !== 1 ? 's' : ''}</Column>
                        </Row>
                        <Hr style={divider} />
                        <Row style={detailRow}>
                            <Column style={detailLabel}>Order ID</Column>
                            <Column style={{ ...detailValue, fontFamily: 'monospace', fontSize: '11px' }}>
                                {orderId}
                            </Column>
                        </Row>
                    </Section>

                    {/* Footer */}
                    <Hr style={footerDivider} />
                    <Text style={footer}>
                        This is an automated alert from Eleven. Log in to your dashboard to view full details.
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

const alertSection = {
    textAlign: 'center' as const,
    padding: '32px 40px 16px',
}

const alertIcon = {
    fontSize: '40px',
    margin: '0 0 12px',
}

const alertTitle = {
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 8px',
}

const alertSubtitle = {
    fontSize: '14px',
    color: '#64748b',
    margin: '0',
}

const amountBox = {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    margin: '0 auto 8px',
    padding: '20px',
    textAlign: 'center' as const,
    width: '80%',
}

const amountLabel = {
    fontSize: '12px',
    color: '#2563eb',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontWeight: '600',
    margin: '0 0 4px',
}

const amountValue = {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1d4ed8',
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

export default MerchantAlertEmail
