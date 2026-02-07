"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, LineChart, Coins } from "lucide-react"
import { toast } from "sonner"

export default function Strategies() {
  const strategies = [
    {
      id: 1,
      name: "Yield Optimization",
      description: "Automatically moves idle stablecoins to the highest yielding Aave or Compound pools.",
      apr: "4.5% - 8.2%",
      risk: "Low",
      icon: Coins,
      enabled: true,
    },
    {
      id: 2,
      name: "ETH Accumulation",
      description: "Uses dollar-cost averaging to accumulate ETH during market dips.",
      apr: "N/A",
      risk: "Medium",
      icon: TrendingUp,
      enabled: false,
    },
    {
      id: 3,
      name: "Liquidity Provision",
      description: "Provides liquidity to Uniswap V3 pools within specific price ranges.",
      apr: "12% - 25%",
      risk: "High",
      icon: LineChart,
      enabled: false,
    },
  ]

  const toggleStrategy = (name: string, enabled: boolean) => {
    toast.success(`${name} has been ${enabled ? "disabled" : "enabled"}`)
  }

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
          {strategies.map((strategy) => (
            <Card key={strategy.id} className={strategy.enabled ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex gap-4">
                  <div
                    className={`h-12 w-12 rounded-lg flex items-center justify-center ${strategy.enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    <strategy.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-1">{strategy.name}</CardTitle>
                    <CardDescription className="max-w-md">{strategy.description}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={strategy.enabled ? "default" : "outline"}>
                    {strategy.enabled ? "Active" : "Disabled"}
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    APR: {strategy.apr}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <span className="font-medium text-foreground">Risk Level:</span>
                  <span
                    className={
                      strategy.risk === "Low"
                        ? "text-green-500"
                        : strategy.risk === "Medium"
                          ? "text-yellow-500"
                          : "text-red-500"
                    }
                  >
                    {strategy.risk}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button
                  variant={strategy.enabled ? "outline" : "default"}
                  onClick={() => toggleStrategy(strategy.name, strategy.enabled)}
                >
                  {strategy.enabled ? "Disable Strategy" : "Enable Strategy"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-8 text-center border rounded-xl border-dashed bg-muted/10">
          <h3 className="text-lg font-medium mb-2">More Strategies Coming Soon</h3>
          <p className="text-muted-foreground mb-4">
            We're constantly adding new yield and trading strategies for your agent.
          </p>
          <Button variant="outline" disabled>
            Suggest a Strategy
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
