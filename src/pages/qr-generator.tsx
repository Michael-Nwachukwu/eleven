"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Download, Share2, Copy, CheckCircle2, Loader2, Info, AlertCircle, Building2, RefreshCw, Eye, EyeOff } from "lucide-react"
import { QrCodeReader } from "@/components/qr-code-reader"
import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import QRCode from "qrcode"
import { encodeX402Payment, getTokenAddress, NETWORKS, type X402PaymentRequest } from "@/lib/x402"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { useAeonBanks } from "@/hooks/useAeonBanks"
import { usePrivy } from "@privy-io/react-auth"

type TokenSymbol = "USDC" | "DAI" | "ETH"
type NetworkKey = keyof typeof NETWORKS

export default function QrGenerator() {
  const { user } = usePrivy()
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
  const [fiatCurrency, setFiatCurrency] = useState<'NGN' | 'VND'>('VND')
  const [vietQRCode, setVietQRCode] = useState('')
  const [showRawInput, setShowRawInput] = useState(false)
  const [selectedBank, setSelectedBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')

  // Use Aeon banks hook
  const {
    banks,
    banksLoading,
    banksError,
    refetchBanks,
    verifyAccount,
    verificationLoading,
    verificationError,
    verifiedAccountName,
    clearVerification
  } = useAeonBanks()

  // Get agent wallet address
  const agentAddress = agent?.agentAddress || ""

  // Auto-verify account when account number reaches 10 digits
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank && paymentMode === 'fiat') {
      // Find the bank code from the selected bank
      const bankCode = selectedBank
      if (bankCode) {
        verifyAccount(bankCode, accountNumber).then(name => {
          if (name) {
            setAccountName(name)
            toast.success(`Account verified: ${name}`)
          }
        })
      }
    } else {
      clearVerification()
    }
  }, [accountNumber, selectedBank, paymentMode, verifyAccount, clearVerification])

  // TEST FUNCTION: Generate a valid test payment request using Aeon's example VietQR
  const handleTestVietQR = () => {
    // Example VietQR from Aeon docs
    const testVietQR = "00020101021138560010A0000007270126000697041501121170028740400208QRIBFTTA53037045802VN63048A1C"

    // Create payment request with this QR code
    const paymentRequest: X402PaymentRequest = {
      maxAmountRequired: "10000", // Just a display placeholder
      resource: 'https://ai-api-sbx.aeon.xyz/open/ai/402/payment', // Sandbox URL
      payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`, // USDC on Arbitrum
      network: 'arbitrum',
      description: "Test Payment (VietQR)",
      metadata: {
        itemName: "Test Payment (VietQR)",
        timestamp: Date.now(),
        mode: 'fiat',
        provider: 'aeon',
        appId: 'TEST000001',
        qrCode: testVietQR, // The critical part - real VietQR code
        currency: 'VND',
        originalAmount: "10000",
        bankName: "Test Bank (Vietnam)",
        accountNumber: "1234567890",
        accountName: "TEST USER"
      }
    }

    console.log('=== TEST VietQR Payment Request ===')
    console.log('Payment Request:', paymentRequest)

    const uri = encodeX402Payment(paymentRequest)
    setX402Uri(uri)

    QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 400,
      margin: 2,
    }).then(url => {
      setQrCodeDataUrl(url)
      setGenerated(true)
      setPaymentMode('fiat')
      setAmount("10000")
      toast.success("Generated Test VietQR Code!")
    })
  }

  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount")
      setIsGenerating(false)
      return
    }

    // Create Payment Order in DB first
    const orderData = {
      amount,
      token: paymentMode === 'crypto' ? token : fiatCurrency, // Use Fiat currency for fiat mode
      currency: paymentMode === 'crypto' ? 'USD' : fiatCurrency, // Approximate
      mode: paymentMode,
      description: description || (paymentMode === 'crypto' ? `Payment request` : `Bank Transfer`),
      status: 'active',
      payTo: agentAddress,
      x402Uri: '', // Will update later or just leave empty in DB for now, or generated client side?
      // Actually, we generate URI *after* allow DB to have ID?
      // Circular dependency if we want URI in DB.
      // Solution: Create order with empty URI -> Get ID -> Generate URI -> Update order with URI (optional)
      // For now, just create order to get ID. We can skip saving URI in DB or update it later if needed.
      // The DB schema has x402Uri. Let's create it with placeholder or just '' then we might not need it in DB if we have all fields.
      // But strictly, we should probably update it.
      // Let's just create order, get ID, generate URI, then maybe update order?
      // Or just leave URI empty in DB for now to save a round trip. Usage in history is mainly for display.
      // IMPORTANT: We need the ID in the URI.
    }

    // We actually need to encode the URI *with* the ID.
    // So: 
    // 1. Create order (POST /api/payment/orders)
    // 2. Get ID
    // 3. Generate URI with ID in metadata
    // 4. (Optional) Update order with encoded URI? (We didn't make an update endpoint yet, only create/get).
    // We can pass the "intended" URI structure to DB? No, we need ID first.
    // Let's just create order, and locally generate URI. The DB record will have empty x402Uri for now
    // unless we add an update endpoint.
    // Actually, `x402Uri` in DB `PaymentOrder` type is good to have.
    // I'll skip updating it for now to avoid complexity, or just store a placeholder.

    let newOrderId = ""

    try {
      const res = await fetch('/api/payment/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          order: { ...orderData, x402Uri: '' }
        })
      })

      if (res.ok) {
        const newOrder = await res.json()
        newOrderId = newOrder.id
        console.log("Created order:", newOrderId)
      } else {
        console.error("Failed to create order persistence")
      }
    } catch (err) {
      console.error("Error creating order:", err)
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
            mode: 'crypto',
            oid: newOrderId // Embed Order ID
          }
        }
      } else if (fiatCurrency === 'VND') {
        // ===== VND FIAT PAYMENT (AEON x402) =====
        if (!vietQRCode.trim()) {
          toast.error('Please scan, upload, or enter the VietQR code')
          setIsGenerating(false)
          return
        }

        paymentRequest = {
          maxAmountRequired: amount,
          resource: 'https://ai-api-sbx.aeon.xyz/open/ai/402/payment',
          payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`,
          network: 'arbitrum',
          description: description || `Payment of ₫${Number(amount).toLocaleString()} VND`,
          metadata: {
            itemName: description || 'VND Bank Transfer',
            timestamp: Date.now(),
            mode: 'fiat',
            provider: 'aeon',
            appId: import.meta.env.VITE_AEON_APP_ID || 'TEST000001',
            qrCode: vietQRCode.trim(),
            currency: 'VND',
            originalAmount: amount,
            bankName: 'Vietnamese Bank',
            accountNumber: '',
            accountName: '',
            oid: newOrderId
          }
        }
      } else {
        // ===== NGN FIAT PAYMENT (AEON BANK TRANSFER) =====
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
        if (!accountName && !verifiedAccountName) {
          toast.error("Please verify your account first")
          setIsGenerating(false)
          return
        }

        const selectedBankData = banks.find(b => b.bankCode === selectedBank)
        if (!selectedBankData) {
          toast.error("Invalid bank selected")
          setIsGenerating(false)
          return
        }

        const finalAccountName = verifiedAccountName || accountName

        paymentRequest = {
          maxAmountRequired: amount,
          resource: 'aeon-bank-transfer',
          payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`,
          network: 'arbitrum',
          description: description || `Payment of ₦${amount} to ${finalAccountName}`,
          metadata: {
            itemName: description || "Bank Transfer Payment",
            timestamp: Date.now(),
            mode: 'fiat',
            provider: 'aeon-bank-transfer',
            appId: import.meta.env.VITE_AEON_APP_ID || 'TEST000001',
            currency: fiatCurrency,
            originalAmount: amount,
            bankCode: selectedBankData.bankCode,
            bankName: selectedBankData.bankName,
            accountNumber: accountNumber,
            accountName: finalAccountName,
            oid: newOrderId
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

      // Save x402Uri back to the order in DB
      if (newOrderId) {
        try {
          await fetch(`/api/payment/order/${newOrderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x402Uri: uri })
          })
        } catch (err) {
          console.error("Error saving URI to order:", err)
        }
      }

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
    if (!x402Uri) return

    const paymentData = x402Uri.replace('x402://', '')
    const paymentLink = `${window.location.origin}/pay/${paymentData}`

    try {
      const displayAmount = paymentMode === 'crypto' ? `${amount} ${token}` : `${amount} ${fiatCurrency}`

      if (navigator.share) {
        await navigator.share({
          title: `Payment Request: ${displayAmount}`,
          text: `Pay ${displayAmount} via PayMe`,
          url: paymentLink,
        })
        toast.success("Payment link shared!")
      } else {
        await navigator.clipboard.writeText(paymentLink)
        toast.success("Payment link copied to clipboard!")
      }
    } catch (error) {
      console.error("Error sharing:", error)
      // Fallback: copy link
      await navigator.clipboard.writeText(paymentLink)
      toast.success("Payment link copied to clipboard!")
    }
  }

  const handleCopyUri = () => {
    navigator.clipboard.writeText(x402Uri)
    toast.success("Payment URI copied to clipboard!")
  }

  const handleCopyPaymentLink = () => {
    const paymentData = x402Uri.replace('x402://', '')
    const paymentLink = `${window.location.origin}/pay/${paymentData}`
    navigator.clipboard.writeText(paymentLink)
    toast.success("Payment link copied!")
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
                    {/* Currency Selector */}
                    <div className="space-y-2">
                      <Label>Currency *</Label>
                      <Select
                        value={fiatCurrency}
                        onValueChange={(value) => {
                          setFiatCurrency(value as 'NGN' | 'VND')
                          setShowRawInput(false)
                        }}
                        disabled={generated}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VND">🇻🇳 Vietnamese Dong (VND)</SelectItem>
                          <SelectItem value="NGN">🇳🇬 Nigerian Naira (NGN)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="fiat-amount">Amount ({fiatCurrency}) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {fiatCurrency === 'VND' ? '₫' : '₦'}
                        </span>
                        <Input
                          id="fiat-amount"
                          type="number"
                          placeholder={fiatCurrency === 'VND' ? '100000' : '10000'}
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

                    {fiatCurrency === 'VND' ? (
                      <>
                        {/* QR Code Input Section */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label>VietQR Code *</Label>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                              onClick={() => setShowRawInput(!showRawInput)}
                            >
                              {showRawInput ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {showRawInput ? 'Hide' : 'Enter'} manually
                            </button>
                          </div>

                          {/* Scan / Upload */}
                          <QrCodeReader
                            onResult={(val) => setVietQRCode(val)}
                            disabled={generated}
                          />

                          {/* Raw input (hidden by default) */}
                          {showRawInput && (
                            <Textarea
                              id="qrcode-raw"
                              placeholder="Paste the VietQR string here (starts with 000201...)"
                              value={vietQRCode}
                              onChange={(e) => setVietQRCode(e.target.value.trim())}
                              disabled={generated}
                              rows={3}
                              className="font-mono text-xs"
                            />
                          )}

                          {/* Sample QR code helper */}
                          <p className="text-xs text-muted-foreground">
                            Don't have one? <button
                              type="button"
                              className="underline text-primary hover:text-primary/80"
                              onClick={() => {
                                setVietQRCode('00020101021138560010A0000007270126000697041501121170028740400208QRIBFTTA53037045802VN63048A1C')
                                toast.success('Sample VietQR code loaded')
                              }}
                            >
                              Use test VietQR code
                            </button>
                          </p>
                        </div>

                        {/* Info Banner */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <div className="flex gap-3">
                            <Building2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            <div className="text-sm space-y-1">
                              <p className="font-medium text-blue-600">Vietnamese Bank Transfer</p>
                              <ul className="text-muted-foreground text-xs space-y-0.5">
                                <li>• Customer pays in crypto (USDC)</li>
                                <li>• Aeon converts to VND (₫)</li>
                                <li>• Recipient receives ₫{Number(amount || 0).toLocaleString()} in their bank</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Bank Selection */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Select Bank *</Label>
                            {banksLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                            {banksError && (
                              <Button variant="ghost" size="sm" onClick={refetchBanks} className="h-6 px-2">
                                <RefreshCw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                          </div>
                          <Select
                            value={selectedBank}
                            onValueChange={(value) => {
                              setSelectedBank(value)
                              setAccountName('')
                              clearVerification()
                            }}
                            disabled={generated || banksLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={banksLoading ? "Loading banks..." : "Choose your bank"} />
                            </SelectTrigger>
                            <SelectContent>
                              {banks.map((bank) => (
                                <SelectItem key={bank.bankCode} value={bank.bankCode}>
                                  {bank.bankName}
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
                          <div className="flex justify-between items-center">
                            <Label htmlFor="accountName">Account Name *</Label>
                            {verificationLoading && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Verifying...
                              </span>
                            )}
                            {verifiedAccountName && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            )}
                            {verificationError && !verifiedAccountName && (
                              <span className="text-xs text-yellow-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Enter manually
                              </span>
                            )}
                          </div>
                          <Input
                            id="accountName"
                            type="text"
                            placeholder={verificationLoading ? "Verifying..." : "Enter account holder name"}
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                            disabled={generated || verificationLoading}
                            required
                            className={verifiedAccountName ? "bg-green-50 border-green-200" : ""}
                          />
                        </div>

                        {/* NGN Info Banner */}
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
                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isGenerating || (paymentMode === 'crypto' && !agentAddress)}
                    >
                      {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Generate QR Code
                    </Button>

                    {paymentMode === 'fiat' && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-xs text-muted-foreground hover:text-primary"
                        onClick={handleTestVietQR}
                      >
                        ⚡ Test with Official VietQR (Aeon Docs)
                      </Button>
                    )}
                  </div>
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
                            <span className="font-semibold">{banks.find(b => b.bankCode === selectedBank)?.bankName}</span>
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
                  <Label className="text-xs text-muted-foreground">Shareable Payment Link</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={x402Uri ? `${window.location.origin}/pay/${x402Uri.replace('x402://', '')}` : ''}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button variant="ghost" size="sm" onClick={handleCopyPaymentLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* x402 URI (collapsed) */}
                <details className="w-full">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Show x402 URI
                  </summary>
                  <div className="flex gap-2 mt-2">
                    <Input value={x402Uri} readOnly className="font-mono text-xs" />
                    <Button variant="ghost" size="sm" onClick={handleCopyUri}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </details>

                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {paymentMode === 'crypto'
                    ? "Scan QR or share the payment link to receive crypto."
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
