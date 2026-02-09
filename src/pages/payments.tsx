"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { QrCode, Send, Scan, ArrowDownToLine, Loader2, ExternalLink, Wallet, AlertCircle, CheckCircle2, Copy } from "lucide-react"
import { Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { usePrivy } from "@privy-io/react-auth"
import { getAgentWallet } from "@/services/thirdweb-agent-service"
import { prepareContractCall, sendTransaction, getContract, readContract } from "thirdweb"
import { thirdwebClient } from "@/services/thirdweb-agent-service"
import { arbitrum } from "thirdweb/chains"
import { parseUnits, formatUnits } from "viem"

type TokenSymbol = "USDC" | "ETH"

// Token addresses on Arbitrum
const TOKEN_ADDRESSES: Record<TokenSymbol, string> = {
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  ETH: "0x0000000000000000000000000000000000000000", // Native ETH
}

export default function Payments() {
  const { agent, loading: agentLoading, hasAgent } = useAgentWallet()
  const { user } = usePrivy()

  // Balances
  const [usdcBalance, setUsdcBalance] = useState<string>("0.00")
  const [ethBalance, setEthBalance] = useState<string>("0.00")
  const [loadingBalances, setLoadingBalances] = useState(false)

  // Send form state
  const [recipient, setRecipient] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [sendToken, setSendToken] = useState<TokenSymbol>("USDC")
  const [isSending, setIsSending] = useState(false)

  // Withdraw form state
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawToken, setWithdrawToken] = useState<TokenSymbol>("USDC")
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // Transaction result
  const [lastTxHash, setLastTxHash] = useState<string>("")

  // Load balances
  useEffect(() => {
    if (agent?.agentAddress) {
      loadBalances()
    }
  }, [agent?.agentAddress])

  const loadBalances = async () => {
    if (!agent?.agentAddress) return
    setLoadingBalances(true)

    try {
      // Get USDC balance
      const usdcContract = getContract({
        client: thirdwebClient,
        address: TOKEN_ADDRESSES.USDC,
        chain: arbitrum,
      })

      const usdcBal = await readContract({
        contract: usdcContract,
        method: "function balanceOf(address account) view returns (uint256)",
        params: [agent.agentAddress as `0x${string}`],
      })
      setUsdcBalance(formatUnits(usdcBal, 6))

      // Get ETH balance via RPC
      const rpcUrl = "https://arb1.arbitrum.io/rpc"
      const ethBalResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [agent.agentAddress, "latest"],
          id: 1,
        }),
      })
      const ethBalData = await ethBalResponse.json()
      const ethBalWei = BigInt(ethBalData.result || "0")
      setEthBalance(formatUnits(ethBalWei, 18))

    } catch (error) {
      console.error("Error loading balances:", error)
    } finally {
      setLoadingBalances(false)
    }
  }

  const handleSend = async () => {
    if (!recipient || !sendAmount || parseFloat(sendAmount) <= 0) {
      toast.error("Please enter a valid recipient and amount")
      return
    }

    if (!user?.id) {
      toast.error("Please sign in first")
      return
    }

    // Validate recipient address
    if (!recipient.startsWith("0x") || recipient.length !== 42) {
      toast.error("Invalid recipient address")
      return
    }

    setIsSending(true)
    try {
      // Get agent private key from localStorage (dev mode)
      const privateKey = localStorage.getItem(`agent_pk_${user.id}`)
      if (!privateKey) {
        throw new Error("Agent private key not found. Please recreate your agent.")
      }

      const { agentWallet } = await getAgentWallet(privateKey)
      const account = agentWallet.getAccount()
      if (!account) throw new Error("Could not get agent account")

      let txHash: string

      if (sendToken === "ETH") {
        // Native ETH transfer
        // For smart wallets, we need to use a different approach
        toast.error("ETH transfers not yet supported for smart wallets")
        setIsSending(false)
        return
      } else {
        // USDC transfer
        const usdcContract = getContract({
          client: thirdwebClient,
          address: TOKEN_ADDRESSES.USDC,
          chain: arbitrum,
        })

        const amountInUnits = parseUnits(sendAmount, 6)

        const transaction = prepareContractCall({
          contract: usdcContract,
          method: "function transfer(address to, uint256 amount) returns (bool)",
          params: [recipient as `0x${string}`, amountInUnits],
        })

        const result = await sendTransaction({
          transaction,
          account,
        })

        txHash = result.transactionHash
      }

      setLastTxHash(txHash)
      toast.success("Payment sent successfully!")

      // Reset form and reload balances
      setRecipient("")
      setSendAmount("")
      await loadBalances()

    } catch (error: any) {
      console.error("Send error:", error)
      toast.error(error.message || "Failed to send payment")
    } finally {
      setIsSending(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAddress || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid withdrawal address and amount")
      return
    }

    if (!user?.id) {
      toast.error("Please sign in first")
      return
    }

    // Validate address
    if (!withdrawAddress.startsWith("0x") || withdrawAddress.length !== 42) {
      toast.error("Invalid withdrawal address")
      return
    }

    // Check balance
    const currentBalance = withdrawToken === "USDC" ? parseFloat(usdcBalance) : parseFloat(ethBalance)
    if (parseFloat(withdrawAmount) > currentBalance) {
      toast.error(`Insufficient ${withdrawToken} balance`)
      return
    }

    setIsWithdrawing(true)
    try {
      // Get agent private key from localStorage (dev mode)
      const privateKey = localStorage.getItem(`agent_pk_${user.id}`)
      if (!privateKey) {
        throw new Error("Agent private key not found. Please recreate your agent.")
      }

      const { agentWallet } = await getAgentWallet(privateKey)
      const account = agentWallet.getAccount()
      if (!account) throw new Error("Could not get agent account")

      let txHash: string

      if (withdrawToken === "ETH") {
        toast.error("ETH withdrawals not yet supported for smart wallets")
        setIsWithdrawing(false)
        return
      } else {
        // USDC withdrawal
        const usdcContract = getContract({
          client: thirdwebClient,
          address: TOKEN_ADDRESSES.USDC,
          chain: arbitrum,
        })

        const amountInUnits = parseUnits(withdrawAmount, 6)

        const transaction = prepareContractCall({
          contract: usdcContract,
          method: "function transfer(address to, uint256 amount) returns (bool)",
          params: [withdrawAddress as `0x${string}`, amountInUnits],
        })

        const result = await sendTransaction({
          transaction,
          account,
        })

        txHash = result.transactionHash
      }

      setLastTxHash(txHash)
      toast.success("Withdrawal successful!")

      // Reset form and reload balances
      setWithdrawAddress("")
      setWithdrawAmount("")
      await loadBalances()

    } catch (error: any) {
      console.error("Withdraw error:", error)
      toast.error(error.message || "Failed to withdraw")
    } finally {
      setIsWithdrawing(false)
    }
  }

  const handleMaxAmount = (type: 'send' | 'withdraw') => {
    const balance = (type === 'send' ? sendToken : withdrawToken) === "USDC"
      ? usdcBalance
      : ethBalance

    if (type === 'send') {
      setSendAmount(balance)
    } else {
      setWithdrawAmount(balance)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard!")
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

  if (!hasAgent) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Agent Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Create an agent wallet first to send and receive payments.
          </p>
          <Button asChild>
            <Link to="/create-agent">Create Agent Wallet</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-2">Send, receive, and withdraw funds from your agent wallet.</p>
        </div>

        {/* Balance Display */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agent Wallet Balance</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-2xl font-bold">${parseFloat(usdcBalance).toFixed(2)}</span>
                    <Badge variant="outline">{parseFloat(ethBalance).toFixed(4)} ETH</Badge>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadBalances}
                disabled={loadingBalances}
              >
                {loadingBalances ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button variant="outline" className="h-20 flex flex-col gap-2 bg-transparent" asChild>
            <Link to="/qr-generator">
              <QrCode className="h-6 w-6" />
              <span>Generate QR</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-20 flex flex-col gap-2 bg-transparent" asChild>
            <Link to="/qr-scanner">
              <Scan className="h-6 w-6" />
              <span>Scan to Pay</span>
            </Link>
          </Button>
        </div>

        {/* Last Transaction */}
        {lastTxHash && (
          <Card className="mb-6 border-green-500/20 bg-green-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-600">Transaction Successful</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{lastTxHash}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(lastTxHash)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`https://arbiscan.io/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Actions */}
        <Tabs defaultValue="send" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send" className="gap-2">
              <Send className="h-4 w-4" /> Send
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="gap-2">
              <ArrowDownToLine className="h-4 w-4" /> Withdraw
            </TabsTrigger>
          </TabsList>

          {/* Send Tab */}
          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle>Send Payment</CardTitle>
                <CardDescription>Transfer funds to another wallet address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Address</Label>
                  <Input
                    id="recipient"
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="sendAmount">Amount</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => handleMaxAmount('send')}
                      >
                        Max
                      </button>
                    </div>
                    <Input
                      id="sendAmount"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Select
                      value={sendToken}
                      onValueChange={(v) => setSendToken(v as TokenSymbol)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC (${usdcBalance})</SelectItem>
                        <SelectItem value="ETH" disabled>ETH ({ethBalance})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Network</span>
                    <span className="font-medium text-foreground">Arbitrum One</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground mt-1">
                    <span>Gas</span>
                    <span className="font-medium text-green-500">Sponsored ✓</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={handleSend}
                  disabled={isSending || !recipient || !sendAmount}
                >
                  {isSending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Send Payment</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw">
            <Card>
              <CardHeader>
                <CardTitle>Withdraw Funds</CardTitle>
                <CardDescription>Transfer funds from your agent wallet to an external wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdrawAddress">Destination Address</Label>
                  <Input
                    id="withdrawAddress"
                    placeholder="0x..."
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the wallet address where you want to receive the funds
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="withdrawAmount">Amount</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => handleMaxAmount('withdraw')}
                      >
                        Max
                      </button>
                    </div>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Select
                      value={withdrawToken}
                      onValueChange={(v) => setWithdrawToken(v as TokenSymbol)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC (${usdcBalance})</SelectItem>
                        <SelectItem value="ETH" disabled>ETH ({ethBalance})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-600">Confirm before withdrawing</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Make sure the destination address is correct. Transactions cannot be reversed.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Available</span>
                    <span className="font-medium text-foreground">
                      {withdrawToken === "USDC" ? `$${usdcBalance}` : `${ethBalance} ETH`}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground mt-1">
                    <span>Network</span>
                    <span className="font-medium text-foreground">Arbitrum One</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground mt-1">
                    <span>Gas</span>
                    <span className="font-medium text-green-500">Sponsored ✓</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant="default"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAddress || !withdrawAmount}
                >
                  {isWithdrawing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Withdrawing...</>
                  ) : (
                    <><ArrowDownToLine className="mr-2 h-4 w-4" /> Withdraw to Wallet</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
