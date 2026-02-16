"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ExternalLink, ArrowLeft, Copy, Share2 } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"
import { toast } from "sonner"
import { type X402PaymentRequest, formatAddress, formatAmount, NETWORKS, getExplorerUrl } from "@/lib/x402"

export default function PaymentSuccess() {
  const location = useLocation()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  // Get payment details from navigation state
  const transactionHash = location.state?.transactionHash as string || ''
  const paymentRequest = location.state?.paymentRequest as X402PaymentRequest | null
  const mode = location.state?.mode as string || 'crypto'

  const isFiatPayment = mode === 'aeon' || paymentRequest?.metadata?.mode === 'fiat'
  const isCryptoPayment = !isFiatPayment

  // Payment details
  const amount = isFiatPayment
    ? paymentRequest?.metadata?.originalAmount || paymentRequest?.maxAmountRequired || '0'
    : paymentRequest?.maxAmountRequired || '0'

  const currency = isFiatPayment
    ? paymentRequest?.metadata?.currency || 'NGN'
    : paymentRequest?.metadata?.token || 'USDC'

  const currencySymbols: Record<string, string> = {
    NGN: '₦', USD: '$', EUR: '€', GBP: '£', VND: '₫', KES: 'KSh',
  }

  const displayAmount = isFiatPayment
    ? `${currencySymbols[currency] || ''}${formatAmount(amount, currency === 'VND' ? 0 : 2)}`
    : `${formatAmount(amount)} ${currency}`

  const networkName = NETWORKS[paymentRequest?.network as keyof typeof NETWORKS]?.name || paymentRequest?.network || 'Arbitrum'

  const bankName = paymentRequest?.metadata?.bankName
  const accountName = paymentRequest?.metadata?.accountName
  const description = paymentRequest?.description

  const handleCopyTxHash = () => {
    if (transactionHash) {
      navigator.clipboard.writeText(transactionHash)
      setCopied(true)
      toast.success("Transaction hash copied!")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const explorerUrl = isCryptoPayment && transactionHash && transactionHash !== 'aeon-settlement'
    ? getExplorerUrl('arbitrum', transactionHash)
    : null

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          {/* Success Animation */}
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
            <div className="relative w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-green-600">Payment Successful!</h1>
          <p className="text-muted-foreground mt-2">
            {isFiatPayment
              ? "Your bank transfer order has been processed."
              : "Your crypto payment has been confirmed on-chain."
            }
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Payment Summary</CardTitle>
              <Badge variant={isFiatPayment ? "secondary" : "default"}>
                {isFiatPayment ? "Bank Transfer" : "Crypto"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount */}
            <div className="text-center py-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
              <p className="text-3xl font-bold">{displayAmount}</p>
              {isFiatPayment && (
                <p className="text-sm text-muted-foreground mt-1">via {networkName}</p>
              )}
            </div>

            {/* Details */}
            <div className="space-y-3">
              {description && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Description</span>
                  <span className="text-sm font-medium">{description}</span>
                </div>
              )}

              {isFiatPayment && bankName && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bank</span>
                    <span className="text-sm font-medium">{bankName}</span>
                  </div>
                  {accountName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Account Name</span>
                      <span className="text-sm font-medium">{accountName}</span>
                    </div>
                  )}
                </>
              )}

              {isCryptoPayment && paymentRequest?.payTo && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <span className="text-sm font-medium font-mono">
                    {formatAddress(paymentRequest.payTo)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="text-sm font-medium">{networkName}</span>
              </div>

              {transactionHash && transactionHash !== 'aeon-settlement' && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Transaction</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium font-mono">
                      {transactionHash.length > 16
                        ? `${transactionHash.slice(0, 8)}...${transactionHash.slice(-6)}`
                        : transactionHash
                      }
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyTxHash}>
                      <Copy className={`h-3 w-3 ${copied ? 'text-green-500' : ''}`} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              <Button className="w-full" variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Arbiscan
              </Button>
            </a>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Link to="/payments">
              <Button className="w-full" variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Payments
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button className="w-full">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
