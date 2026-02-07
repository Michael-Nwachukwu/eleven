"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { type X402PaymentRequest, formatAddress, formatAmount, NETWORKS, getExplorerUrl } from "@/lib/x402"
import { executePayment, type PaymentProgress } from "@/services/payment-service"
import { usePrivy } from "@privy-io/react-auth"

type PaymentStage = 'review' | 'checking' | 'bridging' | 'executing' | 'complete' | 'failed'

export default function PaymentReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = usePrivy()
  const [stage, setStage] = useState<PaymentStage>('review')
  const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null)
  const [transactionHash, setTransactionHash] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [progress, setProgress] = useState(0)

  // Load payment request from navigation state
  useEffect(() => {
    const request = location.state?.paymentRequest as X402PaymentRequest
    if (request) {
      setPaymentRequest(request)
    } else {
      // If no payment request, redirect back
      toast.error("No payment request found")
      navigate("/qr-scanner")
    }
  }, [location, navigate])

  const handleConfirmPayment = async () => {
    if (!paymentRequest) return

    setStage('checking')
    setProgress(10)

    try {
      // Get agent's private key from storage
      // TODO: Retrieve from secure storage
      const agentData = localStorage.getItem("agent-data")
      if (!agentData) {
        throw new Error("No agent wallet found. Please create an agent first.")
      }

      const { privateKey } = JSON.parse(agentData)
      if (!privateKey) {
        throw new Error("Agent private key not found")
      }

      // Detect payment mode
      const mode = paymentRequest.metadata?.provider === 'aeon' ? 'fiat' : 'crypto'

      toast.info(
        mode === 'fiat'
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

      if (result.success && result.transactionHash) {
        setTransactionHash(result.transactionHash)
        setProgress(100)
        setStage('complete')
        toast.success("Payment successful!")

        // Wait a moment then navigate to success page
        setTimeout(() => {
          navigate("/payment-success", {
            state: {
              transactionHash: result.transactionHash,
              paymentRequest,
              mode: result.mode
            }
          })
        }, 2000)
      } else {
        throw new Error(result.error || 'Payment failed')
      }

      // // Mock transaction hash
      // const mockTxHash = '0x' + Array.from({ length: 64 }, () =>
      //   Math.floor(Math.random() * 16).toString(16)
      // ).join('')

      // setTransactionHash(mockTxHash)
      // setProgress(100)
      // setStage('complete')
      // toast.success("Payment successful!")

      // // Wait a moment then navigate to success page
      // setTimeout(() => {
      //   navigate("/payment-success", {
      //     state: {
      //       transactionHash: mockTxHash,
      //       paymentRequest
      //     }
      //   })
      // }, 2000)

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
const tokenSymbol = paymentRequest.metadata?.token || 'Token'

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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Request</CardTitle>
          <CardDescription>
            {paymentRequest.description || 'Cross-chain payment via x402'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount Display */}
          <div className="flex flex-col items-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
            <div className="text-sm text-muted-foreground mb-1">Amount to Send</div>
            <div className="text-4xl font-bold">
              {formatAmount(paymentRequest.maxAmountRequired)} {tokenSymbol}
            </div>
            <div className="text-sm text-muted-foreground mt-1">on {networkName}</div>
          </div>

          {/* Payment Details */}
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Recipient</span>
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
              <span className="font-mono text-xs">{formatAddress(paymentRequest.asset)}</span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="text-muted-foreground text-sm">~$0.05 - $0.50</span>
            </div>

            <div className="flex justify-between py-3 pt-4">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">
                {formatAmount(paymentRequest.maxAmountRequired)} {tokenSymbol}
              </span>
            </div>
          </div>

          {/* CRE Info Banner */}
          {stage === 'review' && (
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-blue-500">Cross-Chain Payment</p>
                  <p className="text-muted-foreground">
                    Your AI agent will automatically check balances across all supported chains and
                    bridge funds if needed to complete this payment.
                  </p>
                </div>
              </div>
            </div>
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
                  <span>Checking balances across chains</span>
                </div>

                <div className={`flex items-center gap-2 text-sm ${stage === 'bridging' ? 'text-primary' : progress >= 40 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                  {stage === 'bridging' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : progress >= 70 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted" />
                  )}
                  <span>Bridging funds (if needed)</span>
                </div>

                <div className={`flex items-center gap-2 text-sm ${stage === 'executing' ? 'text-primary' : progress >= 85 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                  {stage === 'executing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : progress >= 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted" />
                  )}
                  <span>Executing payment</span>
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
              <Button className="flex-1" onClick={handleConfirmPayment}>
                Confirm Payment
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
    </div>
  </DashboardLayout>
)
}
