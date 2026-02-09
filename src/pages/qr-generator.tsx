"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Download, Share2, Copy, CheckCircle2, Loader2, Info, AlertCircle, Building2 } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import QRCode from "qrcode"
import { encodeX402Payment, getTokenAddress, NETWORKS, type X402PaymentRequest } from "@/lib/x402"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { generateNigerianQRCode, getNigerianBanksList, NIGERIAN_BANKS } from "@/lib/nqr-generator"

type TokenSymbol = "USDC" | "DAI" | "ETH"
type NetworkKey = keyof typeof NETWORKS

export default function QrGenerator() {
  const navigate = useNavigate()
  const { agent, loading: agentLoading } = useAgentWallet()

  const [generated, setGenerated] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [x402Uri, setX402Uri] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // Form state
  const [amount, setAmount] = useState("")
  const [token, setToken] = useState<TokenSymbol>("USDC")
  const [network] = useState<NetworkKey>("arbitrum")
  const [description, setDescription] = useState("")

  // Payment mode: 'crypto' or 'fiat'
  const [paymentMode, setPaymentMode] = useState<'crypto' | 'fiat'>('crypto')

  // Fiat specific fields - Bank Details
  const [fiatCurrency, setFiatCurrency] = useState('NGN')
  const [selectedBank, setSelectedBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [merchantCity, setMerchantCity] = useState('Lagos')

  // Get agent wallet address
  const agentAddress = agent?.agentAddress || ""

  // Get bank list for dropdown
  const banksList = getNigerianBanksList()

  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount")
      setIsGenerating(false)
      return
    }

    try {
      let paymentRequest: X402PaymentRequest
      let generatedNQRCode = ""

      if (paymentMode === 'crypto') {
        // ===== CRYPTO PAYMENT =====
        if (!agentAddress) {
          toast.error("No agent wallet found. Please create an agent first.")
          setIsGenerating(false)
          return
        }

        const tokenAddress = getTokenAddress(token, network)
        paymentRequest = {
          maxAmountRequired: amount,
          resource: `payment-${Date.now()}`,
          payTo: agentAddress as `0x${string}`,
          asset: tokenAddress as `0x${string}`,
          network: 'arbitrum',
          description: description || `Payment request for ${amount} ${token}`,
          metadata: {
            itemName: description || "Payment Request",
            timestamp: Date.now(),
            seller: agentAddress,
            token: token,
            mode: 'crypto'
          }
        }
      } else {
        // ===== FIAT PAYMENT (AEON) =====
        // Validate bank details
        if (!selectedBank) {
          toast.error("Please select a bank")
          setIsGenerating(false)
          return
        }
        if (!accountNumber || accountNumber.length !== 10) {
          toast.error("Please enter a valid 10-digit account number")
          setIsGenerating(false)
          return
        }
        if (!accountName) {
          toast.error("Please enter the account name")
          setIsGenerating(false)
          return
        }

        // Generate NQR code from bank details
        const bankCode = NIGERIAN_BANKS[selectedBank]?.code
        if (!bankCode) {
          toast.error("Invalid bank selected")
          setIsGenerating(false)
          return
        }

        try {
          generatedNQRCode = generateNigerianQRCode({
            bankCode,
            accountNumber,
            accountName,
            amount,
            merchantCity,
            reference: `PP-${Date.now()}`
          })
          console.log('Generated NQR Code:', generatedNQRCode)
        } catch (err: any) {
          toast.error(err.message || "Failed to generate NQR code")
          setIsGenerating(false)
          return
        }

        paymentRequest = {
          maxAmountRequired: amount,
          resource: 'https://ai-api.aeon.xyz/open/ai/402/payment',
          payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`, // USDC on Arbitrum
          network: 'arbitrum',
          description: description || `Payment request for ${amount} ${fiatCurrency}`,
          metadata: {
            itemName: description || "Payment Request",
            timestamp: Date.now(),
            mode: 'fiat',
            provider: 'aeon',
            appId: import.meta.env.VITE_AEON_APP_ID || 'TEST000001',
            qrCode: generatedNQRCode,
            currency: fiatCurrency,
            originalAmount: amount,
            bankName: NIGERIAN_BANKS[selectedBank]?.name,
            accountNumber: accountNumber,
            accountName: accountName
          }
        }
      }

      // Log the payment request
      console.log('=== x402 Payment Request Generated ===')
      console.log('Payment Mode:', paymentMode)
      console.log('Payment Request:', paymentRequest)

      // Encode to x402 URI
      const uri = encodeX402Payment(paymentRequest)
      console.log('Encoded x402 URI:', uri)
      setX402Uri(uri)

      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(uri, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      setQrCodeDataUrl(qrDataUrl)
      setGenerated(true)
      toast.success("QR code generated successfully!")

    } catch (error) {
      console.error("Error generating QR code:", error)
      toast.error("Failed to generate QR code")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!qrCodeDataUrl) return

    const link = document.createElement('a')
    link.href = qrCodeDataUrl
    const filename = paymentMode === 'crypto'
      ? `payment-qr-${token}-${amount}.png`
      : `payment-qr-${fiatCurrency}-${amount}.png`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("QR code downloaded!")
  }

  const handleShare = async () => {
    if (!qrCodeDataUrl) return

    try {
      const response = await fetch(qrCodeDataUrl)
      const blob = await response.blob()
      const file = new File([blob], 'payment-qr.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        const displayAmount = paymentMode === 'crypto' ? `${amount} ${token}` : `${amount} ${fiatCurrency}`
        await navigator.share({
          title: `Payment Request: ${displayAmount}`,
          text: `Scan to pay ${displayAmount}`,
          files: [file],
        })
        toast.success("QR code shared!")
      } else {
        await navigator.clipboard.writeText(x402Uri)
        toast.success("Payment link copied to clipboard!")
      }
    } catch (error) {
      console.error("Error sharing:", error)
      toast.error("Failed to share QR code")
    }
  }

  const handleCopyUri = () => {
    navigator.clipboard.writeText(x402Uri)
    toast.success("Payment URI copied to clipboard!")
  }

  const handleReset = () => {
    setGenerated(false)
    setQrCodeDataUrl("")
    setX402Uri("")
    setAmount("")
    setDescription("")
  }

  if (agentLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Generate Payment QR</h1>
          <p className="text-muted-foreground mt-2">Create a QR code to request payment on Arbitrum.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>Configure your payment request</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateQR} className="space-y-5">

                {/* ===== PAYMENT TYPE SELECTOR ===== */}
                <div className="space-y-3">
                  <Label>Payment Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={paymentMode === 'crypto' ? 'default' : 'outline'}
                      onClick={() => setPaymentMode('crypto')}
                      disabled={generated}
                      className="w-full h-auto py-3"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-lg mb-1">💰</span>
                        <span className="font-medium">Crypto</span>
                        <span className="text-xs opacity-70">Direct to wallet</span>
                      </div>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMode === 'fiat' ? 'default' : 'outline'}
                      onClick={() => setPaymentMode('fiat')}
                      disabled={generated}
                      className="w-full h-auto py-3"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-lg mb-1">🏦</span>
                        <span className="font-medium">Bank Transfer</span>
                        <span className="text-xs opacity-70">Via Aeon to NGN</span>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* ===== CRYPTO MODE FIELDS ===== */}
                {paymentMode === 'crypto' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount *</Label>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={generated}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Token *</Label>
                        <Select
                          value={token}
                          onValueChange={(value) => setToken(value as TokenSymbol)}
                          disabled={generated}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select token" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="DAI">DAI</SelectItem>
                            <SelectItem value="ETH">ETH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Receiving Wallet</Label>
                      {agentAddress ? (
                        <Input
                          value={agentAddress}
                          readOnly
                          className="font-mono text-xs bg-muted/50"
                          disabled
                        />
                      ) : (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div className="text-sm">
                              <span className="font-medium text-yellow-600">No agent wallet found.</span>
                              <p className="text-muted-foreground mt-1">
                                <Link to="/create-agent" className="underline">Create an agent</Link> to receive payments.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Funds go directly to your agent wallet on Arbitrum
                      </p>
                    </div>
                  </>
                )}

                {/* ===== FIAT/BANK MODE FIELDS ===== */}
                {paymentMode === 'fiat' && (
                  <>
                    {/* Amount (in NGN) */}
                    <div className="space-y-2">
                      <Label htmlFor="fiat-amount">Amount (NGN) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                        <Input
                          id="fiat-amount"
                          type="number"
                          placeholder="10000"
                          step="1"
                          min="100"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={generated}
                          className="pl-8"
                          required
                        />
                      </div>
                    </div>

                    {/* Bank Selection */}
                    <div className="space-y-2">
                      <Label>Select Bank *</Label>
                      <Select
                        value={selectedBank}
                        onValueChange={setSelectedBank}
                        disabled={generated}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose your bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {banksList.map((bank) => (
                            <SelectItem key={bank.value} value={bank.value}>
                              {bank.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Account Number */}
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input
                        id="accountNumber"
                        type="text"
                        placeholder="0123456789"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        disabled={generated}
                        required
                      />
                      {accountNumber && accountNumber.length !== 10 && (
                        <p className="text-xs text-yellow-600">Account number must be 10 digits</p>
                      )}
                    </div>

                    {/* Account Name */}
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name *</Label>
                      <Input
                        id="accountName"
                        type="text"
                        placeholder="John Doe"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                        disabled={generated}
                        required
                      />
                    </div>

                    {/* City */}
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Lagos"
                        value={merchantCity}
                        onChange={(e) => setMerchantCity(e.target.value)}
                        disabled={generated}
                      />
                    </div>

                    {/* Info Banner */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex gap-3">
                        <Building2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        <div className="text-sm space-y-1">
                          <p className="font-medium text-blue-600">Nigerian Bank Transfer</p>
                          <ul className="text-muted-foreground text-xs space-y-0.5">
                            <li>• Customer pays in crypto (USDC)</li>
                            <li>• Aeon converts to Naira (₦)</li>
                            <li>• You receive ₦{amount || '0'} in your bank</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Network (always Arbitrum) */}
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Input value="Arbitrum One" readOnly disabled className="bg-muted/50" />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="e.g. Coffee, Consulting services, Invoice #123"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={generated}
                    rows={2}
                  />
                </div>

                {/* Submit Button */}
                {!generated ? (
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isGenerating || (paymentMode === 'crypto' && !agentAddress)}
                  >
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate QR Code
                  </Button>
                ) : (
                  <Button type="button" onClick={handleReset} variant="outline" className="w-full">
                    Generate New QR
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* QR Code Display */}
          <div className="flex flex-col items-center justify-center">
            {generated && qrCodeDataUrl ? (
              <div className="space-y-6 text-center w-full">
                <Card className="p-6 bg-white dark:bg-gray-900">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <img
                        src={qrCodeDataUrl}
                        alt="Payment QR Code"
                        className="w-full max-w-[280px] h-auto rounded-lg"
                      />
                      <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="bg-muted/50 rounded-lg p-4 w-full">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-semibold">
                            {paymentMode === 'crypto' ? '💰 Crypto' : '🏦 Bank Transfer'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-semibold">
                            {paymentMode === 'crypto' ? `${amount} ${token}` : `₦${parseFloat(amount).toLocaleString()}`}
                          </span>
                        </div>
                        {paymentMode === 'fiat' && selectedBank && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bank:</span>
                            <span className="font-semibold">{NIGERIAN_BANKS[selectedBank]?.name}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Network:</span>
                          <span className="font-semibold">Arbitrum</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-center w-full">
                  <Button variant="outline" onClick={handleDownload} className="flex-1">
                    <Download className="mr-2 h-4 w-4" /> Save
                  </Button>
                  <Button variant="outline" onClick={handleShare} className="flex-1">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                </div>

                {/* Copy URI */}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground">x402 Payment URI</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={x402Uri} readOnly className="font-mono text-xs" />
                    <Button variant="ghost" size="sm" onClick={handleCopyUri}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {paymentMode === 'crypto'
                    ? "Scan to send crypto directly to your agent wallet."
                    : "Customer pays crypto, you receive Naira in your bank."}
                </p>
              </div>
            ) : (
              <div className="text-center p-12 border rounded-xl border-dashed bg-muted/10 w-full h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    className="h-8 w-8 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                </div>
                <h3 className="font-medium mb-1">No QR Code Generated</h3>
                <p className="text-muted-foreground text-sm">Fill out the form to generate a payment request</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
