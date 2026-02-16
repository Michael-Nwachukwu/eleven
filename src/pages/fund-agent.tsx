"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Copy, Info, ArrowRight, CheckCircle2, AlertCircle, Wallet, QrCode, ExternalLink, Loader2, ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { QRCodeSVG } from "qrcode.react"
import { parseEther } from "viem"

type FundingStatus = "pending" | "checking" | "funded"

export default function FundAgent() {
  const navigate = useNavigate()
  const { user, linkWallet } = usePrivy()
  const { wallets } = useWallets()
  const { agent, loading: agentLoading } = useAgentWallet()

  const [fundingStatus, setFundingStatus] = useState<FundingStatus>("pending")
  const [showQR, setShowQR] = useState(false)
  const [fundingAmount, setFundingAmount] = useState("0.05")
  const [isTransferring, setIsTransferring] = useState(false)
  const [fundingToken, setFundingToken] = useState<'ETH' | 'USDC'>('ETH')

  // USDC contract on Arbitrum One
  const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  const USDC_DECIMALS = 6

  // Get agent address
  const agentAddress = agent?.agentAddress

  // Identify external wallet
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy')

  useEffect(() => {
    // Poll for balance changes or initial check
    if (!agentAddress) return

    const checkFundingStatus = async () => {
      try {
        // Fetch ETH balance
        const response = await fetch(
          `https://arb1.arbitrum.io/rpc`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [agentAddress, 'latest'],
              id: 1,
            }),
          }
        )
        const data = await response.json()
        const ethWei = BigInt(data.result || '0')

        if (ethWei > BigInt(0)) {
          setFundingStatus("funded")
        }
      } catch (error) {
        console.error("Error checking funding status:", error)
      }
    }

    checkFundingStatus()
    const interval = setInterval(checkFundingStatus, 10000)
    return () => clearInterval(interval)
  }, [agentAddress])

  const copyAddress = () => {
    if (agentAddress) {
      navigator.clipboard.writeText(agentAddress)
      toast.success("Address copied to clipboard")
    }
  }

  const handleFundFromExternalWallet = async () => {
    if (!externalWallet) {
      try {
        await linkWallet()
      } catch (err) {
        console.error("Error linking wallet:", err)
      }
      return
    }

    if (!agentAddress) return

    setIsTransferring(true)
    try {
      // Switch chain to Arbitrum if needed
      if (externalWallet.chainId !== 'eip155:42161') {
        try {
          await externalWallet.switchChain(42161)
        } catch (e) {
          toast.error("Please switch your wallet to Arbitrum One")
          setIsTransferring(false)
          return
        }
      }

      const provider = await externalWallet.getEthereumProvider()

      let hash: string

      if (fundingToken === 'ETH') {
        // ETH transfer
        const amountWei = parseEther(fundingAmount)
        hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: externalWallet.address,
            to: agentAddress as `0x${string}`,
            value: `0x${amountWei.toString(16)}`,
          }]
        })
      } else {
        // USDC ERC-20 transfer
        const amountFloat = parseFloat(fundingAmount)
        if (isNaN(amountFloat) || amountFloat <= 0) {
          toast.error("Invalid amount")
          setIsTransferring(false)
          return
        }
        const atomicAmount = BigInt(Math.round(amountFloat * (10 ** USDC_DECIMALS)))

        // Encode transfer(address,uint256)
        const transferSelector = '0xa9059cbb'
        const paddedTo = (agentAddress as string).slice(2).padStart(64, '0')
        const paddedAmount = atomicAmount.toString(16).padStart(64, '0')
        const data = `${transferSelector}${paddedTo}${paddedAmount}`

        hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: externalWallet.address,
            to: USDC_ADDRESS,
            data,
            value: '0x0',
          }]
        })
      }

      toast.success("Transaction sent!", {
        description: `Tx Hash: ${hash}`
      })

      // Wait a bit for indexing then check status
      setTimeout(() => setFundingStatus("checking"), 2000)

    } catch (err: any) {
      console.error("Funding error:", err)
      toast.error(err.message || "Failed to send transaction")
    } finally {
      setIsTransferring(false)
    }
  }

  const handleManualVerify = async () => {
    setFundingStatus("checking")
    toast.info("Checking for funds...")

    // The poll effect will pick it up, just delay UI update slightly
    setTimeout(() => {
      if (fundingStatus !== "funded") {
        toast.info("Still waiting for funds. It may take a minute.")
        setFundingStatus("pending")
      }
    }, 3000)
  }

  const handleContinueToDashboard = () => {
    navigate("/dashboard")
  }

  if (agentLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center space-y-4 pt-20">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">No Agent Found</h2>
          <Button onClick={() => navigate("/create-agent")}>Create Agent</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-4 pl-0" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Fund Your Agent</h1>
              <p className="text-muted-foreground mt-2">
                Deposit assets to enable your agent to execute strategies and payments.
              </p>
            </div>
            <Badge
              variant={fundingStatus === "funded" ? "default" : "secondary"}
              className={fundingStatus === "funded" ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {fundingStatus === "funded" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {fundingStatus === "funded" ? "Funded" : fundingStatus === "checking" ? "Checking..." : "Awaiting Funds"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Qr & Address */}
          <Card className="md:row-span-2 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Deposit Address
              </CardTitle>
              <CardDescription>Scan or copy to send ETH/USDC</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                {agentAddress && <QRCodeSVG value={agentAddress} size={180} />}
              </div>

              <div className="w-full space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Network</label>
                <div className="flex items-center gap-2 font-medium">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Arbitrum One
                </div>
              </div>

              <div className="w-full space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
                <div className="flex gap-2">
                  <Input value={agentAddress || ''} readOnly className="font-mono text-xs bg-muted/50" />
                  <Button variant="outline" size="icon" onClick={copyAddress}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Funding Options */}
          <div className="space-y-6">

            {/* Option 1: External Wallet */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fund from External Wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={fundingAmount}
                    onChange={(e) => setFundingAmount(e.target.value)}
                    className="w-24"
                    step={fundingToken === 'ETH' ? '0.01' : '1'}
                  />
                  <div className="flex rounded-md border overflow-hidden">
                    <button
                      onClick={() => { setFundingToken('ETH'); setFundingAmount('0.05') }}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${fundingToken === 'ETH'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                        }`}
                    >
                      ETH
                    </button>
                    <button
                      onClick={() => { setFundingToken('USDC'); setFundingAmount('10') }}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${fundingToken === 'USDC'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                        }`}
                    >
                      USDC
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleFundFromExternalWallet}
                  disabled={isTransferring}
                >
                  {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {externalWallet ? `Send ${fundingAmount} ${fundingToken} from ${externalWallet.walletClientType}` : "Connect Wallet to Send"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Connect your MetaMask, Coinbase, or other wallet to transfer {fundingToken} directly.
                </p>
              </CardContent>
            </Card>

            {/* Option 2: Bridge */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bridge Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="https://bridge.arbitrum.io" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Official Arbitrum Bridge
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="https://app.across.to" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Across Bridge (Fast)
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Full Width: Status */}
          <div className="md:col-span-2">
            <Card className={fundingStatus === 'funded' ? "bg-green-500/10 border-green-500/20" : ""}>
              <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                {fundingStatus === 'funded' ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-600">Funding Verified!</h3>
                      <p className="text-sm text-muted-foreground">Your agent is ready to operate.</p>
                    </div>
                    <Button onClick={handleContinueToDashboard} className="bg-green-600 hover:bg-green-700">
                      Go to Dashboard
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={handleManualVerify} disabled={fundingStatus === 'checking'}>
                    {fundingStatus === 'checking' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify Balance
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
