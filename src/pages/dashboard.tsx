"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { usePrivy } from "@privy-io/react-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentCard } from "@/components/ui/agent-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Bot, ArrowUpRight, QrCode, Wallet, TrendingUp, Settings } from "lucide-react"
import { Link, useNavigate, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"

export default function Dashboard() {
  const { user, authenticated, ready } = usePrivy()
  const navigate = useNavigate()

  // Mock state for agent existence
  // In a real app, this would come from an API/smart contract
  const [hasAgent, setHasAgent] = useState<boolean>(false)

  // Check local storage to simulate persistence across the demo
  useEffect(() => {
    const agentCreated = localStorage.getItem("agent-created") === "true"
    setHasAgent(agentCreated)
  }, [])

  // Added authentication check to redirect if not logged in
  if (ready && !authenticated) {
    return <Navigate to="/" />
  }

  if (!hasAgent) {
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

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">Overview of your autonomous agent</p>
          </div>
          <Button asChild>
            <Link to="/payments">
              Send Payment <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <AgentCard name="Prime Alpha Agent" address="0x71C...9A23" balance="4.2" status="active" />
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
                <Link to="/strategies">
                  <TrendingUp className="mr-2 h-4 w-4" /> Manage Strategies
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                <Link to="/agent-settings">
                  <Settings className="mr-2 h-4 w-4" /> Agent Settings
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest transactions and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Payment Sent</p>
                      <p className="text-xs text-muted-foreground">To 0xAB...45cd</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">-0.05 ETH</p>
                    <p className="text-xs text-muted-foreground">2 mins ago</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Funds Received</p>
                      <p className="text-xs text-muted-foreground">From Coinbase</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">+1.5 ETH</p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Strategy Rebalanced</p>
                      <p className="text-xs text-muted-foreground">Yield Optimizer</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">Auto</p>
                    <p className="text-xs text-muted-foreground">5 hours ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
