"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Loader2, ExternalLink, Building2, Wallet, Shield, Zap } from "lucide-react"
import { useParams, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { decodeX402Payment, type X402PaymentRequest, formatAddress, formatAmount, NETWORKS, getExplorerUrl } from "@/lib/x402"
import { executePayment, executeExternalWalletPayment, type PaymentProgress } from "@/services/payment-service"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useAgentWallet } from "@/hooks/useAgentWallet"

type PaymentStage = 'loading' | 'review' | 'login' | 'checking' | 'executing' | 'complete' | 'failed'
type PaymentMethod = 'external' | 'agent' | null

const EXTERNAL_FEE_PERCENT = 2.5
const AGENT_FEE_PERCENT = 0.5

export default function PayPage() {
    const { paymentData } = useParams<{ paymentData: string }>()
    const navigate = useNavigate()
    const { user, login, ready, authenticated } = usePrivy()
    const { wallets } = useWallets()
    const { agent, hasAgent } = useAgentWallet()

    const [stage, setStage] = useState<PaymentStage>('loading')
    const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null)
    const [transactionHash, setTransactionHash] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [progress, setProgress] = useState(0)
    const [decodeError, setDecodeError] = useState('')
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null)
    const [payerName, setPayerName] = useState('')
    const [payerEmail, setPayerEmail] = useState('')
    const [isRecording, setIsRecording] = useState(false)

    // Detect payment mode
    const isFiatPayment = paymentRequest?.metadata?.mode === 'fiat' || paymentRequest?.metadata?.provider === 'aeon'
    const isCryptoPayment = !isFiatPayment

    // External wallet
    const externalWallet = wallets.find(w => w.walletClientType !== 'privy')

    // Decode payment data from URL
    useEffect(() => {
        if (!paymentData) {
            setDecodeError("No payment data in URL")
            return
        }

        try {
            const decoded = decodeX402Payment(`x402://${paymentData}`)
            setPaymentRequest(decoded)
            setStage(authenticated ? 'review' : 'login')
        } catch (err: any) {
            console.error('Failed to decode payment data:', err)
            setDecodeError(err.message || 'Invalid payment link')
        }
    }, [paymentData, authenticated])

    // Update stage when auth state changes
    useEffect(() => {
        if (ready && authenticated && stage === 'login') {
            setStage('review')
        }
    }, [ready, authenticated, stage])

    // === PAYMENT HANDLERS ===

    const handleExternalWalletPayment = async () => {
        if (!paymentRequest || !externalWallet) return

        setStage('checking')
        setProgress(10)

        try {
            // Switch to Arbitrum if needed
            if (externalWallet.chainId !== 'eip155:42161') {
                try {
                    await externalWallet.switchChain(42161)
                } catch {
                    throw new Error("Please switch your wallet to Arbitrum One")
                }
            }

            const provider = await externalWallet.getEthereumProvider()

            const onProgress = (progressInfo: PaymentProgress) => {
                setStage(progressInfo.stage as PaymentStage)
                setProgress(progressInfo.progress)
            }

            const result = await executeExternalWalletPayment(
                paymentRequest,
                provider,
                externalWallet.address,
                onProgress
            )

            if (result.success) {
                if (result.transactionHash) setTransactionHash(result.transactionHash)
                setProgress(90)

                // Record fulfillment
                await recordFulfillment(result.transactionHash || '', 'external', result.amount || '0')
                sendNotification(result.transactionHash || '')

                setProgress(100)
                setStage('complete')
                toast.success("Payment successful!")
            } else {
                throw new Error(result.error || 'Payment failed')
            }
        } catch (error: any) {
            console.error("External wallet payment error:", error)
            setStage('failed')
            setErrorMessage(error.message || "Payment failed. Please try again.")
            toast.error("Payment failed")
        }
    }

    const handleAgentWalletPayment = async () => {
        if (!paymentRequest) return

        setStage('checking')
        setProgress(10)

        try {
            if (!user?.id) {
                throw new Error("Please log in first")
            }

            let privateKey = localStorage.getItem(`agent_pk_${user.id}`)

            // If not in localStorage, fetch from server (e.g. different browser/device)
            if (!privateKey) {
                const pkRes = await fetch(`/api/agent/${user.id}?action=private-key`)
                if (!pkRes.ok) {
                    throw new Error("No agent wallet found. Please create an agent first from the dashboard.")
                }
                const pkData = await pkRes.json()
                privateKey = pkData.privateKey
                if (!privateKey) {
                    throw new Error("No agent wallet found. Please create an agent first from the dashboard.")
                }
                // Cache it for subsequent payments
                localStorage.setItem(`agent_pk_${user.id}`, privateKey)
            }

            const onProgress = (progressInfo: PaymentProgress) => {
                setStage(progressInfo.stage as PaymentStage)
                setProgress(progressInfo.progress)
            }

            const result = await executePayment(paymentRequest, privateKey, onProgress)

            if (result.success) {
                if (result.transactionHash) setTransactionHash(result.transactionHash)
                setProgress(90)

                // Record fulfillment
                await recordFulfillment(result.transactionHash || '', 'agent', result.amount || '0')
                sendNotification(result.transactionHash || '')

                setProgress(100)
                setStage('complete')
                toast.success("Payment successful!")
            } else {
                throw new Error(result.error || 'Payment failed')
            }
        } catch (error: any) {
            console.error("Payment error:", error)
            setStage('failed')
            setErrorMessage(error.message || "Payment failed. Please try again.")
            toast.error("Payment failed")
        }
    }

    const recordFulfillment = async (txHash: string, method: string, amountPaid: string) => {
        if (!paymentRequest?.metadata?.oid) return

        setIsRecording(true)
        try {
            await fetch('/api/payment/fulfillments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: paymentRequest.metadata.oid,
                    fulfillment: {
                        payerName,
                        payerEmail,
                        amount: amountPaid,
                        fee: '0', // TODO: Calculate actual fee
                        transactionHash: txHash,
                        paymentMethod: method
                    }
                })
            })
        } catch (err) {
            console.error("Error recording fulfillment:", err)
            // Don't fail the payment flow for this, just log it
        } finally {
            setIsRecording(false)
        }
    }

    const handleConfirmPayment = () => {
        if (paymentMethod === 'external') {
            handleExternalWalletPayment()
        } else {
            handleAgentWalletPayment()
        }
    }

    // Fire-and-forget: send email receipt to payer + alert to merchant
    const sendNotification = (_txHash: string) => {
        const orderId = paymentRequest?.metadata?.oid
        if (!orderId) {
            console.warn('[Notification] No orderId (oid) in payment metadata — skipping email notification')
            return
        }
        console.log('[Notification] Sending receipt for order:', orderId)
        fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                payerEmail: payerEmail.trim() || undefined,
                payerName: payerName.trim() || undefined,
            }),
        })
            .then(async (res) => {
                const data = await res.json()
                if (res.ok) {
                    console.log('[Notification] Sent:', data)
                } else {
                    console.error('[Notification] API error:', res.status, data)
                }
            })
            .catch(err => console.error('[Notification] Network error:', err))
    }

    // === DISPLAY HELPERS ===
    const currencySymbols: Record<string, string> = {
        NGN: '₦', USD: '$', EUR: '€', GBP: '£', VND: '₫', KES: 'KSh',
    }

    const exchangeRates: Record<string, number> = {
        NGN: 1550, USD: 1, EUR: 0.92, GBP: 0.79, VND: 24500, KES: 153,
    }

    const fiatCurrency = paymentRequest?.metadata?.currency || 'NGN'
    const fiatAmount = paymentRequest?.metadata?.originalAmount || paymentRequest?.maxAmountRequired || '0'
    const tokenSymbol = paymentRequest?.metadata?.token || 'USDC'
    const networkName = NETWORKS[paymentRequest?.network as keyof typeof NETWORKS]?.name || 'Arbitrum'

    const baseAmount = parseFloat(paymentRequest?.maxAmountRequired || '0')
    const feePercent = paymentMethod === 'external' ? EXTERNAL_FEE_PERCENT : AGENT_FEE_PERCENT
    const feeAmount = baseAmount * (feePercent / 100)
    const totalAmount = baseAmount + feeAmount

    const calculateUsdcEquivalent = (amount: string, currency: string): string => {
        const rate = exchangeRates[currency] || 1
        return (parseFloat(amount) / rate).toFixed(2)
    }

    const explorerUrl = transactionHash && transactionHash !== 'aeon-settlement'
        ? getExplorerUrl('arbitrum', transactionHash)
        : null

    // === ERROR STATE ===
    if (decodeError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="text-center py-12">
                        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Invalid Payment Link</h2>
                        <p className="text-muted-foreground mb-4">{decodeError}</p>
                        <Button variant="outline" onClick={() => navigate('/')}>
                            Go Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // === LOADING STATE ===
    if (stage === 'loading' || !paymentRequest) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading payment details...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6">
                {/* Header */}
                <div className="text-center">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Wallet className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold">Payment Request</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {paymentRequest.description || "You've been sent a payment request"}
                    </p>
                </div>

                {/* Payment Card */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Details</CardTitle>
                            <Badge variant={isFiatPayment ? "secondary" : "default"}>
                                {isFiatPayment ? `${fiatCurrency} Bank Transfer` : `${tokenSymbol} Payment`}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Amount Display */}
                        <div className="text-center py-4 bg-muted/50 rounded-lg">
                            {isFiatPayment ? (
                                <>
                                    <p className="text-sm text-muted-foreground">Amount</p>
                                    <p className="text-3xl font-bold mt-1">
                                        {currencySymbols[fiatCurrency] || ''}{formatAmount(fiatAmount, fiatCurrency === 'VND' ? 0 : 2)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        ≈ {calculateUsdcEquivalent(fiatAmount, fiatCurrency)} USDC
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">Amount</p>
                                    <p className="text-3xl font-bold mt-1">
                                        {formatAmount(paymentRequest.maxAmountRequired)} {tokenSymbol}
                                    </p>
                                    {paymentMethod && (
                                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                            <p>Fee: {feeAmount.toFixed(4)} {tokenSymbol} ({feePercent}%)</p>
                                            <p className="font-medium text-foreground">Total: {totalAmount.toFixed(4)} {tokenSymbol}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Bank Details (fiat) */}
                        {isFiatPayment && paymentRequest.metadata?.bankName && (
                            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Building2 className="h-4 w-4" />
                                    Bank Transfer Details
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-muted-foreground">Bank</span>
                                    <span className="font-medium">{paymentRequest.metadata.bankName}</span>
                                    <span className="text-muted-foreground">Account</span>
                                    <span className="font-medium">{paymentRequest.metadata.accountNumber}</span>
                                    {paymentRequest.metadata.accountName && (
                                        <>
                                            <span className="text-muted-foreground">Name</span>
                                            <span className="font-medium">{paymentRequest.metadata.accountName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Crypto Details */}
                        {isCryptoPayment && (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Recipient</span>
                                    <span className="font-mono font-medium">{formatAddress(paymentRequest.payTo)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Network</span>
                                    <span className="font-medium">{networkName}</span>
                                </div>
                            </div>
                        )}

                        {/* Security Note */}
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                            <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Payments are processed securely on the {networkName} network.</span>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3">
                        {/* Login Required */}
                        {stage === 'login' && (
                            <Button className="w-full" size="lg" onClick={login}>
                                Connect Wallet to Pay
                            </Button>
                        )}

                        {/* Review → Choose Payment Method */}
                        {stage === 'review' && (
                            <>
                                <div className="space-y-3 mb-4 w-full">
                                    <Label className="text-sm font-medium">Your Details</Label>
                                    <div className="grid gap-2 w-full">
                                        <Input
                                            placeholder="Your Name"
                                            value={payerName}
                                            onChange={(e) => setPayerName(e.target.value)}
                                            className="bg-background"
                                        />
                                        <Input
                                            type="email"
                                            placeholder="Email Address"
                                            value={payerEmail}
                                            onChange={(e) => setPayerEmail(e.target.value)}
                                            className="bg-background"
                                        />
                                    </div>
                                </div>
                                {/* Payment Method Selection for Crypto */}
                                {isCryptoPayment && !paymentMethod && (
                                    <div className="w-full space-y-3">
                                        <p className="text-sm font-medium text-center">Choose payment method</p>

                                        {/* External Wallet Option */}
                                        <button
                                            onClick={() => setPaymentMethod('external')}
                                            className="w-full p-4 rounded-lg border-2 border-muted hover:border-primary/50 transition-colors text-left space-y-1"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <Wallet className="h-4 w-4" />
                                                    External Wallet
                                                </div>
                                                <Badge variant="secondary" className="text-xs">
                                                    {EXTERNAL_FEE_PERCENT}% fee
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Pay directly from MetaMask, Coinbase Wallet, or any connected wallet.
                                            </p>
                                        </button>

                                        {/* Agent Wallet Option */}
                                        <button
                                            onClick={() => setPaymentMethod('agent')}
                                            className="w-full p-4 rounded-lg border-2 border-muted hover:border-primary/50 transition-colors text-left space-y-1"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <Zap className="h-4 w-4" />
                                                    Agent Wallet
                                                </div>
                                                <Badge variant="default" className="text-xs bg-green-600">
                                                    {AGENT_FEE_PERCENT}% fee
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Pay from your funded agent wallet. Lower fees, auto-pilot ready.
                                            </p>
                                        </button>
                                    </div>
                                )}

                                {/* Fiat → always agent wallet */}
                                {isFiatPayment && !paymentMethod && (
                                    <div className="w-full space-y-3">
                                        {!hasAgent && (
                                            <div className="w-full text-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                                                ⚠️ You need an agent wallet. <a href="/create-agent" className="underline font-medium">Create one first</a>.
                                            </div>
                                        )}
                                        <Button
                                            className="w-full"
                                            size="lg"
                                            onClick={() => {
                                                setPaymentMethod('agent')
                                                handleAgentWalletPayment()
                                            }}
                                            disabled={!hasAgent}
                                        >
                                            Confirm Payment
                                        </Button>
                                    </div>
                                )}

                                {/* Method Selected → Confirm */}
                                {paymentMethod && isCryptoPayment && (
                                    <div className="w-full space-y-3">
                                        {/* Fee Summary */}
                                        <div className="p-3 rounded-lg bg-muted/30 space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Method</span>
                                                <span className="font-medium">
                                                    {paymentMethod === 'external' ? '🔗 External Wallet' : '⚡ Agent Wallet'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Base Amount</span>
                                                <span>{baseAmount.toFixed(4)} {tokenSymbol}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Fee ({feePercent}%)</span>
                                                <span>{feeAmount.toFixed(4)} {tokenSymbol}</span>
                                            </div>
                                            <div className="flex justify-between font-bold border-t pt-1">
                                                <span>Total</span>
                                                <span>{totalAmount.toFixed(4)} {tokenSymbol}</span>
                                            </div>
                                        </div>

                                        {/* Wallet-specific checks */}
                                        {paymentMethod === 'external' && !externalWallet && (
                                            <div className="w-full text-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                                                ⚠️ No external wallet connected. Please connect one via Settings.
                                            </div>
                                        )}
                                        {paymentMethod === 'agent' && !hasAgent && (
                                            <div className="w-full text-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                                                ⚠️ You need an agent wallet. <a href="/create-agent" className="underline font-medium">Create one first</a>.
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => setPaymentMethod(null)}
                                                className="flex-shrink-0"
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                className="w-full"
                                                size="lg"
                                                onClick={handleConfirmPayment}
                                                disabled={
                                                    (paymentMethod === 'external' && !externalWallet) ||
                                                    (paymentMethod === 'agent' && !hasAgent)
                                                }
                                            >
                                                Pay {totalAmount.toFixed(2)} {tokenSymbol}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Processing */}
                        {(stage === 'checking' || stage === 'executing') && (
                            <div className="w-full text-center space-y-3">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                <p className="text-sm text-muted-foreground">
                                    {stage === 'checking' ? 'Preparing payment...' : 'Processing payment...'}
                                </p>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Success */}
                        {stage === 'complete' && (
                            <div className="w-full text-center space-y-3">
                                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                                <p className="text-lg font-bold text-green-600">Payment Complete!</p>
                                <p className="text-sm text-muted-foreground">Thank you for your payment.</p>
                                {explorerUrl && (
                                    <a href={explorerUrl} target="_blank" rel="noreferrer">
                                        <Button variant="outline" size="sm">
                                            <ExternalLink className="h-3 w-3 mr-1" /> View on Arbiscan
                                        </Button>
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Failed */}
                        {stage === 'failed' && (
                            <div className="w-full text-center space-y-3">
                                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                                <p className="text-sm text-destructive">{errorMessage}</p>
                                <Button variant="outline" onClick={() => { setStage('review'); setPaymentMethod(null) }}>
                                    Try Again
                                </Button>
                            </div>
                        )}
                    </CardFooter>
                </Card>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground">
                    Powered by Eleven • Secure blockchain payments
                </p>
            </div>
        </div>
    )
}
