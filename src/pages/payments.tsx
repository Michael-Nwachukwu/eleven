"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QrCode, Scan, Loader2, ExternalLink, Wallet, CheckCircle2, Copy, AlertCircle, ChevronDown, ChevronUp, History } from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { usePrivy } from "@privy-io/react-auth"
import { readContract } from "thirdweb"
import { thirdwebClient } from "@/services/thirdweb-agent-service"
import { arbitrum } from "thirdweb/chains"
import { formatUnits } from "viem"
import QRCode from "qrcode"
import { PaymentOrder, PaymentFulfillment } from "@/lib/db"

// USDC contract on Arbitrum
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

export default function Payments() {
  const { agent, loading: agentLoading, hasAgent } = useAgentWallet()
  const { user, authenticated, ready } = usePrivy()

  // Balances
  const [usdcBalance, setUsdcBalance] = useState<string>("0.00")
  const [ethBalance, setEthBalance] = useState<string>("0.00")
  const [loadingBalances, setLoadingBalances] = useState(false)

  // Orders State
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderFulfillments, setOrderFulfillments] = useState<Record<string, PaymentFulfillment[]>>({})
  const [orderQrCodes, setOrderQrCodes] = useState<Record<string, string>>({})
  const [loadingFulfillments, setLoadingFulfillments] = useState<string | null>(null)

  // Auth check
  if (ready && !authenticated) {
    return <Navigate to="/" />
  }

  // Load balances
  useEffect(() => {
    if (agent?.agentAddress) {
      loadBalances()
    }
  }, [agent?.agentAddress])

  // Load orders
  useEffect(() => {
    if (user?.id) {
      loadOrders()
    }
  }, [user?.id])

  const loadBalances = async () => {
    if (!agent?.agentAddress) return
    setLoadingBalances(true)

    try {
      // Get USDC balance
      const usdcBalanceRaw = await readContract({
        contract: {
          client: thirdwebClient,
          chain: arbitrum,
          address: USDC_ADDRESS,
        },
        method: "function balanceOf(address) view returns (uint256)",
        params: [agent.agentAddress as `0x${string}`],
      })
      setUsdcBalance(formatUnits(usdcBalanceRaw, 6))

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

  const loadOrders = async () => {
    if (!user?.id) return
    setLoadingOrders(true)
    try {
      const response = await fetch(`/api/payment/orders?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      }
    } catch (error) {
      console.error("Error loading orders:", error)
      toast.error("Failed to load payment orders")
    } finally {
      setLoadingOrders(false)
    }
  }

  const toggleOrderExpand = async (order: PaymentOrder) => {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null)
      return
    }

    setExpandedOrderId(order.id)

    // Generate QR if missing
    if (!orderQrCodes[order.id] && order.x402Uri) {
      try {
        const qrDataUrl = await QRCode.toDataURL(order.x402Uri, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          width: 200,
          margin: 1,
        })
        setOrderQrCodes(prev => ({ ...prev, [order.id]: qrDataUrl }))
      } catch (err) {
        console.error("Error generating QR:", err)
      }
    }

    // Load fulfillments if missing
    if (!orderFulfillments[order.id]) {
      setLoadingFulfillments(order.id)
      try {
        const response = await fetch(`/api/payment/fulfillments?orderId=${order.id}`)
        if (response.ok) {
          const data = await response.json()
          setOrderFulfillments(prev => ({ ...prev, [order.id]: data.fulfillments || [] }))
        }
      } catch (error) {
        console.error("Error loading fulfillments:", error)
      } finally {
        setLoadingFulfillments(null)
      }
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
    // Rely on Dashboard to show empty state usually, but handle it here too
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Agent Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Create an agent wallet first to manage payments.
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
      <div className="max-w-3xl mx-auto pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Payment Orders</h1>
          <p className="text-muted-foreground mt-2">Manage your payment requests and track incoming funds.</p>
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
        <div className="grid grid-cols-2 gap-4 mb-8">
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

        {/* Orders List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Payment History</h2>
            <Button variant="ghost" size="sm" onClick={loadOrders} disabled={loadingOrders}>
              {loadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            </Button>
          </div>

          {orders.length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <History className="h-6 w-6 opacity-50" />
                </div>
                <p className="font-medium">No payment orders yet</p>
                <p className="text-sm mt-1">Generate a QR code to create a payment request.</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/qr-generator">Create Payment Request</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            orders.map(order => (
              <Card key={order.id} className="overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleOrderExpand(order)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                      {order.mode === 'fiat' ? '₦' : '$'}
                    </div>
                    <div>
                      <div className="font-medium">{order.description || "Payment Request"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold">
                        {order.mode === 'fiat' ? '₦' : ''}{order.amount} {order.mode === 'crypto' ? order.token : ''}
                      </div>
                      <Badge variant={order.fulfillmentCount > 0 ? "default" : "secondary"} className="text-[10px]">
                        {order.fulfillmentCount} Paid
                      </Badge>
                    </div>
                    {expandedOrderId === order.id ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedOrderId === order.id && (
                  <div className="border-t bg-muted/10 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* QR Code Section */}
                      <div className="flex flex-col items-center space-y-2 min-w-[180px]">
                        {orderQrCodes[order.id] ? (
                          <img src={orderQrCodes[order.id]} alt="Payment QR" className="w-32 h-32 rounded-lg border bg-white p-1" />
                        ) : (
                          <div className="w-32 h-32 rounded-lg border bg-muted flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(order.x402Uri)
                        }}>
                          <Copy className="h-3 w-3 mr-1" /> Copy URI
                        </Button>
                      </div>

                      {/* Fulfillments List */}
                      <div className="flex-1 space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Recent Payments</h4>

                        {loadingFulfillments === order.id ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : orderFulfillments[order.id]?.length > 0 ? (
                          <div className="space-y-2">
                            {orderFulfillments[order.id].map(f => (
                              <div key={f.id} className="bg-background border rounded-md p-3 text-sm flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{f.payerName || "Anonymous"}</div>
                                  <div className="text-xs text-muted-foreground">{f.payerEmail || "No email"}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-green-600">+{f.amount}</div>
                                  <a
                                    href={`https://arbiscan.io/tx/${f.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-muted-foreground hover:underline flex items-center justify-end gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Tx <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground py-2 italic">
                            No payments received yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
