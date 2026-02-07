"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { usePrivy } from "@privy-io/react-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentCard } from "@/components/ui/agent-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Bot, ArrowUpRight, QrCode, Wallet, TrendingUp, Settings, Copy, ExternalLink, Loader2 } from "lucide-react"
import { Link, useNavigate, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { toast } from "sonner"
import { readContract } from "thirdweb"
import { thirdwebClient } from "@/services/thirdweb-agent-service"
import { arbitrum } from "thirdweb/chains"

// USDC contract on Arbitrum
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

export default function Dashboard() {
  const { user, authenticated, ready } = usePrivy()
  const navigate = useNavigate()
  const { agent, loading: agentLoading } = useAgentWallet()

  const [usdcBalance, setUsdcBalance] = useState<string>("0")
  const [ethBalance, setEthBalance] = useState<string>("0")
  const [loadingBalances, setLoadingBalances] = useState(false)

  // Fetch balances when agent is loaded
  useEffect(() => {
    async function fetchBalances() {
      if (!agent?.agentAddress) return

      setLoadingBalances(true)
      try {
        // Fetch USDC balance
        const usdcBalanceRaw = await readContract({
          contract: {
            client: thirdwebClient,
            chain: arbitrum,
            address: USDC_ADDRESS,
          },
          method: "function balanceOf(address) view returns (uint256)",
          params: [agent.agentAddress as `0x${string}`],
        })

        // USDC has 6 decimals
        const usdcFormatted = (Number(usdcBalanceRaw) / 1e6).toFixed(2)
        setUsdcBalance(usdcFormatted)

        // Fetch ETH balance
        const response = await fetch(
          `https://arb1.arbitrum.io/rpc`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [agent.agentAddress, 'latest'],
              id: 1,
            }),
          }
        )
        const data = await response.json()
        const ethWei = BigInt(data.result || '0')
        const ethFormatted = (Number(ethWei) / 1e18).toFixed(4)
        setEthBalance(ethFormatted)
      } catch (error) {
        console.error('Error fetching balances:', error)
      } finally {
        setLoadingBalances(false)
      }
    }

    fetchBalances()
  }, [agent?.agentAddress])

  // Copy address to clipboard
  const copyAddress = () => {
    if (agent?.agentAddress) {
      navigator.clipboard.writeText(agent.agentAddress)
      toast.success("Address copied to clipboard!")
    }
  }

  // Open in block explorer
  const openInExplorer = () => {
    if (agent?.agentAddress) {
      window.open(`https://arbiscan.io/address/${agent.agentAddress}`, '_blank')
    }
  }

  // Added authentication check to redirect if not logged in
  if (ready && !authenticated) {
    return <Navigate to="/" />
  }

  // Loading state
  if (agentLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // No agent state
  if (!agent) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">Welcome back, {user?.email?.address || user?.wallet?.address}</p>
          </div>

          <EmptyState
            icon={Bot}
            title="No Agent Found"
            description="You haven't deployed an autonomous agent yet. Create one to get started with automated payments and strategies."
            actionLabel="Create AI Agent"
            onAction={() => navigate("/create-agent")}
          />
        </div>
      </DashboardLayout>
    )
  }

  // Format address for display
  const shortAddress = `${agent.agentAddress.slice(0, 6)}...${agent.agentAddress.slice(-4)}`

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">Overview of your payment agent</p>
          </div>
          <Button asChild>
            <Link to="/qr-generator">
              Generate QR Code <QrCode className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Agent Wallet Card */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Agent Wallet
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Smart account on Arbitrum
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={copyAddress}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={openInExplorer}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">Wallet Address</div>
                  <div className="font-mono text-sm break-all">{agent.agentAddress}</div>
                </div>

                {/* Balances */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">USDC Balance</div>
                    {loadingBalances ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="text-2xl font-bold">{usdcBalance} USDC</div>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">ETH Balance</div>
                    {loadingBalances ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="text-2xl font-bold">{ethBalance} ETH</div>
                    )}
                  </div>
                </div>

                {/* Created Date */}
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(agent.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks for your agent</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                <Link to="/fund-agent">
                  <Wallet className="mr-2 h-4 w-4" /> Fund Agent
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                <Link to="/qr-generator">
                  <QrCode className="mr-2 h-4 w-4" /> Generate Payment QR
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                <Link to="/payments">
                  <ArrowUpRight className="mr-2 h-4 w-4" /> Send Payment
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Agent Info */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Information</CardTitle>
              <CardDescription>Details about your payment agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="text-sm font-medium">Arbitrum One</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Wallet Type</span>
                <span className="text-sm font-medium">Smart Account</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm font-medium text-green-500">Active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Payment Modes</span>
                <span className="text-sm font-medium">Crypto + Fiat</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
