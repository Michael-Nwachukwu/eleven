"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2, ExternalLink, Building2, Wallet } from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { type X402PaymentRequest, formatAddress, formatAmount, NETWORKS, getExplorerUrl } from "@/lib/x402"
import { executePayment, type PaymentProgress } from "@/services/payment-service"
import { usePrivy } from "@privy-io/react-auth"
import { useAgentWallet } from "@/hooks/useAgentWallet"

type PaymentStage = 'review' | 'checking' | 'bridging' | 'executing' | 'complete' | 'failed'

export default function PaymentReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = usePrivy()
  const { agent, hasAgent } = useAgentWallet()
  const [stage, setStage] = useState<PaymentStage>('review')
  const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null)
  const [transactionHash, setTransactionHash] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [progress, setProgress] = useState(0)

  // Detect payment mode from metadata
  const isFiatPayment = paymentRequest?.metadata?.mode === 'fiat' || paymentRequest?.metadata?.provider === 'aeon'

  // Load payment request from navigation state
  useEffect(() => {
    const request = location.state?.paymentRequest as X402PaymentRequest
    if (request) {
      console.log('Payment Request Loaded:', request)
      console.log('Metadata:', request.metadata)
      setPaymentRequest(request)
    } else {
      toast.error("No payment request found")
      navigate("/qr-scanner")
    }
  }, [location, navigate])

  const handleConfirmPayment = async () => {
    if (!paymentRequest) return

    setStage('checking')
    setProgress(10)

    try {
      // Get agent's private key from storage using the correct key format
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      // The correct localStorage key format used by useAgentWallet hook
      const privateKey = localStorage.getItem(`agent_pk_${user.id}`)
      if (!privateKey) {
        throw new Error("No agent wallet found. Please create an agent first.")
      }

      toast.info(
        isFiatPayment
          ? 'Processing Aeon fiat settlement...'
          : 'Processing crypto transfer...'
      )

      // Execute payment (service automatically detects mode)
      const onProgress = (progressInfo: PaymentProgress) => {
        setStage(progressInfo.stage)
        setProgress(progressInfo.progress)
      }

      const result = await executePayment(
        paymentRequest,
        privateKey,
        onProgress
      )

      console.log('=== Payment Result ===', result)

      if (result.success) {
        // For Aeon payments, there may not be an on-chain transaction hash
        // The payment is settled via bank transfer
        if (result.transactionHash) {
          setTransactionHash(result.transactionHash)
        }
        setProgress(100)
        setStage('complete')
        toast.success("Payment successful!")

        // Wait a moment then navigate to success page
        setTimeout(() => {
          navigate("/payment-success", {
            state: {
              transactionHash: result.transactionHash || 'aeon-settlement',
              paymentRequest,
              mode: result.mode
            }
          })
        }, 2000)
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

  const handleCancel = () => {
    if (stage === 'review') {
      navigate("/payments")
    }
  }

  const handleRetry = () => {
    setStage('review')
    setProgress(0)
    setErrorMessage('')
  }

  if (!paymentRequest) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment request...</p>
        </div>
      </DashboardLayout>
    )
  }

  const networkName = NETWORKS[paymentRequest.network as keyof typeof NETWORKS]?.name || paymentRequest.network

  // === FIAT PAYMENT DISPLAY INFO ===
  const fiatAmount = paymentRequest.metadata?.originalAmount || paymentRequest.maxAmountRequired
  const fiatCurrency = paymentRequest.metadata?.currency || 'NGN'
  const bankName = paymentRequest.metadata?.bankName
  const accountNumber = paymentRequest.metadata?.accountNumber
  const accountName = paymentRequest.metadata?.accountName

  // === EXCHANGE RATES (Approximate - in production, fetch from Aeon or price oracle) ===
  // Rate = how many units of this currency per 1 USD/USDC
  const exchangeRates: Record<string, number> = {
    NGN: 1550,   // 1 USD ≈ 1550 NGN
    USD: 1,      // 1 USD = 1 USDC
    EUR: 0.92,   // 1 USD ≈ 0.92 EUR
    GBP: 0.79,   // 1 USD ≈ 0.79 GBP
    VND: 24500,  // 1 USD ≈ 24,500 VND
    KES: 153,    // 1 USD ≈ 153 KES
  }

  // Calculate USDC equivalent for fiat payments
  const calculateUsdcEquivalent = (amount: string, currency: string): string => {
    const rate = exchangeRates[currency] || 1
    const usdcAmount = parseFloat(amount) / rate
    // Round to 2 decimal places
    return usdcAmount.toFixed(2)
  }

  const usdcEquivalent = isFiatPayment ? calculateUsdcEquivalent(fiatAmount, fiatCurrency) : fiatAmount

  // === CRYPTO PAYMENT DISPLAY INFO ===
  const tokenSymbol = paymentRequest.metadata?.token || 'USDC'
  const cryptoAmount = paymentRequest.maxAmountRequired

  // Currency symbols
  const currencySymbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    EUR: '€',
    GBP: '£',
    VND: '₫',
    KES: 'KSh',
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <Link
            to="/qr-scanner"
            className="text-muted-foreground hover:text-foreground flex items-center mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Scanner
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Review Payment</h1>
              <p className="text-muted-foreground mt-2">Verify the transaction details before confirming.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                variant={
                  stage === 'complete' ? 'default' :
                    stage === 'failed' ? 'destructive' :
                      'secondary'
                }
                className={stage === 'complete' ? 'bg-green-500' : ''}
              >
                {stage === 'review' && 'Pending'}
                {stage === 'checking' && 'Checking...'}
                {stage === 'bridging' && 'Bridging...'}
                {stage === 'executing' && 'Executing...'}
                {stage === 'complete' && 'Complete'}
                {stage === 'failed' && 'Failed'}
              </Badge>
              <Badge variant="outline" className={isFiatPayment ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'}>
                {isFiatPayment ? '🏦 Bank Transfer' : '💰 Crypto Payment'}
              </Badge>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Request</CardTitle>
            <CardDescription>
              {paymentRequest.description || paymentRequest.metadata?.itemName || 'Payment via x402'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* === FIAT PAYMENT DISPLAY === */}
            {isFiatPayment ? (
              <>
                {/* Fiat Amount Display */}
                <div className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/20">
                  <div className="text-sm text-muted-foreground mb-1">Amount to Receive</div>
                  <div className="text-4xl font-bold">
                    {currencySymbols[fiatCurrency] || ''}{parseFloat(fiatAmount).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{fiatCurrency}</div>
                </div>

                {/* Bank Account Details */}
                <div className="space-y-3">
                  {bankName && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Bank
                      </span>
                      <span className="font-medium">{bankName}</span>
                    </div>
                  )}

                  {accountNumber && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Account Number</span>
                      <span className="font-mono">{accountNumber}</span>
                    </div>
                  )}

                  {accountName && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Account Name</span>
                      <span className="font-medium text-right max-w-[200px]">{accountName}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Settlement Via</span>
                    <span className="font-medium">Aeon</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">You Pay (Crypto)</span>
                    <span className="font-medium">~${usdcEquivalent} USDC</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Network</span>
                    <span>{networkName}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Gas Fee</span>
                    <span className="text-green-500 font-medium">Sponsored ✓</span>
                  </div>

                  <div className="flex justify-between py-3 pt-4 bg-muted/30 -mx-6 px-6 rounded-b-lg">
                    <span className="font-semibold">Merchant Receives</span>
                    <span className="font-bold text-lg text-green-600">
                      {currencySymbols[fiatCurrency] || ''}{parseFloat(fiatAmount).toLocaleString()} {fiatCurrency}
                    </span>
                  </div>
                </div>

                {/* Aeon Info Banner */}
                {stage === 'review' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                    <div className="flex gap-3">
                      <Building2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-blue-500">Fiat Settlement via Aeon</p>
                        <p className="text-muted-foreground">
                          You pay in crypto (USDC). Aeon converts and sends {fiatCurrency} directly to the merchant's bank account.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* === CRYPTO PAYMENT DISPLAY === */}
                {/* Crypto Amount Display */}
                <div className="flex flex-col items-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                  <div className="text-sm text-muted-foreground mb-1">Amount to Send</div>
                  <div className="text-4xl font-bold">
                    {formatAmount(cryptoAmount)} {tokenSymbol}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">on {networkName}</div>
                </div>

                {/* Crypto Payment Details */}
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Wallet className="h-4 w-4" /> Recipient
                    </span>
                    <span className="font-mono text-sm">{formatAddress(paymentRequest.payTo)}</span>
                  </div>

                  {paymentRequest.metadata?.itemName && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Description</span>
                      <span className="text-right max-w-[200px] truncate">
                        {paymentRequest.metadata.itemName}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Network</span>
                    <span>{networkName}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Token</span>
                    <span className="font-medium">{tokenSymbol}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Gas Fee</span>
                    <span className="text-muted-foreground text-sm">~$0.05 - $0.50</span>
                  </div>

                  <div className="flex justify-between py-3 pt-4">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">
                      {formatAmount(cryptoAmount)} {tokenSymbol}
                    </span>
                  </div>
                </div>

                {/* Crypto Payment Info */}
                {stage === 'review' && (
                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
                    <div className="flex gap-3">
                      <Wallet className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-purple-500">Direct Crypto Transfer</p>
                        <p className="text-muted-foreground">
                          Sending {tokenSymbol} directly from your agent wallet to the recipient on {networkName}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Progress Indicator */}
            {(stage === 'checking' || stage === 'bridging' || stage === 'executing') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className={`flex items-center gap-2 text-sm ${stage === 'checking' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {stage === 'checking' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <span>{isFiatPayment ? 'Connecting to Aeon...' : 'Checking wallet balance...'}</span>
                  </div>

                  <div className={`flex items-center gap-2 text-sm ${stage === 'executing' ? 'text-primary' : progress >= 60 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                    {stage === 'executing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : progress >= 100 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />
                    )}
                    <span>{isFiatPayment ? 'Processing settlement...' : 'Executing transfer...'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Success State */}
            {stage === 'complete' && transactionHash && (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2 flex-1">
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Payment Successful!
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Transaction Hash:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                          {transactionHash}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = getExplorerUrl(paymentRequest.network as any, transactionHash)
                            window.open(url, '_blank')
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {stage === 'failed' && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium text-red-600 dark:text-red-400">
                      Payment Failed
                    </p>
                    <p className="text-muted-foreground">
                      {errorMessage || 'An error occurred while processing your payment.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex gap-4 border-t pt-6">
            {stage === 'review' && (
              <>
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmPayment}
                  disabled={!hasAgent}
                >
                  {!hasAgent ? 'No Agent Wallet' : 'Confirm Payment'}
                </Button>
              </>
            )}

            {(stage === 'checking' || stage === 'bridging' || stage === 'executing') && (
              <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing payment... Do not close this window</span>
              </div>
            )}

            {stage === 'complete' && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => navigate("/payment-success", { state: { transactionHash, paymentRequest } })}
              >
                View Receipt
              </Button>
            )}

            {stage === 'failed' && (
              <>
                <Button variant="outline" className="flex-1" onClick={() => navigate("/payments")}>
                  Go Back
                </Button>
                <Button className="flex-1" onClick={handleRetry}>
                  Try Again
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* No Agent Warning */}
        {!hasAgent && stage === 'review' && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="font-medium text-yellow-600">No Agent Wallet Found</p>
                <p className="text-muted-foreground">
                  You need an agent wallet to make payments.
                </p>
                <Button size="sm" asChild>
                  <Link to="/create-agent">Create Agent Wallet</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
