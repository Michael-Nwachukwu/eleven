"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, Wallet, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAgentWallet } from "@/hooks/useAgentWallet"

export default function CreateAgent() {
  const navigate = useNavigate()
  const { agent, loading, createAgent } = useAgentWallet()
  const [isCreating, setIsCreating] = useState(false)
  const [agentAddress, setAgentAddress] = useState<string>("")

  // Check if agent already exists and redirect
  useEffect(() => {
    if (!loading && agent) {
      // Agent already exists, redirect to dashboard
      toast.info("You already have an agent wallet!")
      navigate("/dashboard")
    }
  }, [agent, loading, navigate])

  const handleCreateAgent = async () => {
    setIsCreating(true)

    try {
      const newAgent = await createAgent()
      setAgentAddress(newAgent.agentAddress)
      toast.success("Agent wallet created successfully!")

      // Auto-redirect to fund page after 2 seconds
      setTimeout(() => {
        navigate("/fund-agent")
      }, 2000)
    } catch (error: any) {
      console.error("Error creating agent:", error)
      toast.error(error.message || "Failed to create agent. Please try again.")
      setIsCreating(false)
    }
  }

  // Show loading while checking for existing agent
  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Checking for existing agent...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // Success state
  if (agentAddress) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center justify-center text-center space-y-6">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Agent Wallet Created!</h3>
                  <p className="text-muted-foreground mt-2">
                    Your smart account is ready to process payments on Arbitrum.
                  </p>
                </div>

                {/* Wallet Address Display */}
                <div className="w-full max-w-md bg-muted/50 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">Agent Wallet Address</div>
                  <div className="font-mono text-sm break-all">{agentAddress}</div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Redirecting to fund page in 2 seconds...
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => navigate("/fund-agent")} size="lg">
                    Fund Agent Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button onClick={() => navigate("/dashboard")} variant="outline" size="lg">
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // Creating state
  if (isCreating) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">Creating Your Agent Wallet</h3>
                  <p className="text-muted-foreground mt-2">
                    Setting up smart account on Arbitrum...
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-muted-foreground">Generating wallet keys</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-muted-foreground">Encrypting private key</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-muted-foreground">Storing in database</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // Initial state - ready to create
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create Payment Agent</h1>
          <p className="text-muted-foreground mt-2">
            Deploy a smart account wallet to receive payments on Arbitrum.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Smart Account Wallet
            </CardTitle>
            <CardDescription>
              Create a ThirdWeb smart account for your payment agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </div>
                <div>
                  <div className="font-medium">Secure Storage</div>
                  <div className="text-sm text-muted-foreground">
                    Private keys encrypted and stored securely
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </div>
                <div>
                  <div className="font-medium">Arbitrum Network</div>
                  <div className="text-sm text-muted-foreground">
                    Fast and low-cost transactions on Arbitrum
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </div>
                <div>
                  <div className="font-medium">Dual Payment Modes</div>
                  <div className="text-sm text-muted-foreground">
                    Accept crypto payments or fiat settlement via Aeon
                  </div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <Wallet className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-blue-500">What happens next?</p>
                  <p className="text-muted-foreground">
                    We'll create a smart account wallet managed by ThirdWeb. Your private key will be
                    encrypted and stored securely. You can then generate QR codes to
                    receive payments in crypto or fiat on Arbitrum.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={handleCreateAgent} disabled={isCreating} size="lg" className="w-full">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Wallet...
                </>
              ) : (
                "Create Agent Wallet"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
