"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, LineChart, Coins, Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useAgentWallet } from "@/hooks/useAgentWallet"

export default function Strategies() {
  const { user } = usePrivy()
  const { agent } = useAgentWallet()

  const [yieldEnabled, setYieldEnabled] = useState(false)
  const [apy, setApy] = useState<number | null>(null)
  const [aUsdcBalance, setAUsdcBalance] = useState<number | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [positionLoading, setPositionLoading] = useState(false)

  useEffect(() => {
    if (agent?.yieldEnabled !== undefined) setYieldEnabled(agent.yieldEnabled)
  }, [agent?.yieldEnabled])

  const fetchPosition = () => {
    if (!user?.id) return
    setPositionLoading(true)
    fetch(`/api/agent/${user.id}?action=yield-position`)
      .then(r => r.json())
      .then(data => {
        if (data.aUsdcBalance !== undefined) setAUsdcBalance(data.aUsdcBalance)
        if (data.apy !== undefined) setApy(data.apy)
      })
      .catch(() => { })
      .finally(() => setPositionLoading(false))
  }

  useEffect(() => {
    if (yieldEnabled && user?.id) fetchPosition()
  }, [yieldEnabled, user?.id])

  const handleToggleYield = async (enable: boolean) => {
    if (!user?.id) return
    setToggleLoading(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=update-yield-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yieldEnabled: enable,
          yieldAllocationPercent: agent?.yieldAllocationPercent ?? 40,
          yieldMonthlyLimit: agent?.yieldMonthlyLimit ?? 0,
          yieldAutoHarvest: agent?.yieldAutoHarvest ?? true,
        }),
      })
      if (res.ok) {
        setYieldEnabled(enable)
        toast.success(enable ? "Yield Optimization enabled!" : "Yield Optimization disabled")
      } else {
        toast.error("Failed to update yield settings")
      }
    } catch {
      toast.error("Failed to update yield settings")
    } finally {
      setToggleLoading(false)
    }
  }

  const handleDeposit = async () => {
    if (!user?.id || !depositAmount) return
    setDepositLoading(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=yield-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: depositAmount }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Deposited ${depositAmount} USDC to Aave!`, { description: `Tx: ${data.txHash?.slice(0, 18)}…` })
        setDepositAmount('')
        setTimeout(fetchPosition, 4000)
      } else {
        toast.error(data.error || "Deposit failed")
      }
    } catch {
      toast.error("Deposit failed")
    } finally {
      setDepositLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!user?.id) return
    const amount = withdrawAmount || 'all'
    setWithdrawLoading(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=yield-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Withdrew ${amount === 'all' ? 'all funds' : withdrawAmount + ' USDC'} from Aave!`, { description: `Tx: ${data.txHash?.slice(0, 18)}…` })
        setWithdrawAmount('')
        setTimeout(fetchPosition, 4000)
      } else {
        toast.error(data.error || "Withdraw failed")
      }
    } catch {
      toast.error("Withdraw failed")
    } finally {
      setWithdrawLoading(false)
    }
  }

  const comingSoon = [
    { id: 2, name: "ETH Accumulation", description: "Uses dollar-cost averaging to accumulate ETH during market dips.", apr: "N/A", risk: "Medium", icon: TrendingUp },
    { id: 3, name: "Liquidity Provision", description: "Provides liquidity to Uniswap V3 pools within specific price ranges.", apr: "12% - 25%", risk: "High", icon: LineChart },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Agent Strategies</h1>
          <p className="text-muted-foreground mt-2">
            Enable autonomous financial strategies for your agent to execute.
          </p>
        </div>

        <div className="grid gap-6">
          {/* ── Yield Optimization (LIVE) ── */}
          <Card className={yieldEnabled ? "border-primary/50 bg-primary/5" : ""}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex gap-4">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${yieldEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl mb-1">Yield Optimization</CardTitle>
                  <CardDescription className="max-w-md">
                    Automatically deposits a configured % of each incoming crypto payment into Aave V3 on Arbitrum.
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={yieldEnabled ? "default" : "outline"}>
                  {yieldEnabled ? "Active" : "Disabled"}
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  APR: {apy !== null ? `${apy}%` : "~1.8%"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <span className="font-medium text-foreground">Risk Level:</span>
                <span className="text-green-500">Low</span>
                <span className="ml-4 font-medium text-foreground">Protocol:</span>
                <span>Aave V3 · Arbitrum</span>
              </div>

              {yieldEnabled && (
                <div className="mt-4 space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3 border">
                      <div className="text-muted-foreground mb-1">aUSDC Balance</div>
                      <div className="text-2xl font-bold">
                        {positionLoading
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : `$${(aUsdcBalance ?? 0).toFixed(2)}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">earning {apy ?? '~1.8'}% APY</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 border">
                      <div className="text-muted-foreground mb-1">Allocation Setting</div>
                      <div className="text-2xl font-bold">{agent?.yieldAllocationPercent ?? 40}%</div>
                      <div className="text-xs text-muted-foreground mt-1">of each crypto payment → Aave</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Manual Deposit (USDC)</Label>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Amount" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} min="0" className="h-9 text-sm" />
                        <Button size="sm" onClick={handleDeposit} disabled={depositLoading || !depositAmount}>
                          {depositLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Withdraw (blank = all)</Label>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="All" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} min="0" className="h-9 text-sm" />
                        <Button size="sm" variant="outline" onClick={handleWithdraw} disabled={withdrawLoading}>
                          {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure allocation % and monthly limit in <strong>Agent Settings → Yield Strategy</strong>.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end pt-0">
              <Button variant={yieldEnabled ? "outline" : "default"} onClick={() => handleToggleYield(!yieldEnabled)} disabled={toggleLoading}>
                {toggleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {yieldEnabled ? "Disable Strategy" : "Enable Strategy"}
              </Button>
            </CardFooter>
          </Card>

          {/* ── Coming Soon ── */}
          {comingSoon.map(strategy => (
            <Card key={strategy.id} className="relative overflow-hidden opacity-70">
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <Badge className="text-sm px-4 py-1.5 bg-background border shadow-md text-blue-800 dark:text-white">🚧 Coming Soon</Badge>
              </div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
                    <strategy.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-1">{strategy.name}</CardTitle>
                    <CardDescription className="max-w-md">{strategy.description}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline">Disabled</Badge>
                  <Badge variant="secondary" className="font-mono">APR: {strategy.apr}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <span className="font-medium text-foreground">Risk Level:</span>
                  <span className={strategy.risk === "Medium" ? "text-yellow-500" : "text-red-500"}>{strategy.risk}</span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button variant="default" disabled>Enable Strategy</Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-8 text-center border rounded-xl border-dashed bg-muted/10">
          <h3 className="text-lg font-medium mb-2">More Strategies Coming Soon</h3>
          <p className="text-muted-foreground mb-4">We're constantly adding new yield and trading strategies for your agent.</p>
          <Button variant="outline" disabled>Suggest a Strategy</Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
