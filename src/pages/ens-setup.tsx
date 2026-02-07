import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, ArrowRight, CheckCircle2, XCircle, Loader2, Info, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

type ENSStatus = "idle" | "checking" | "available" | "unavailable" | "registering" | "registered"

export default function EnsSetup() {
  const navigate = useNavigate()
  const [ensName, setEnsName] = useState("")
  const [status, setStatus] = useState<ENSStatus>("idle")
  const [agentAddress, setAgentAddress] = useState<string>("") // This will come from created agent

  // Get agent address from localStorage (from create-agent flow)
  useEffect(() => {
    const agentData = localStorage.getItem("agent-data")
    if (agentData) {
      const parsed = JSON.parse(agentData)
      // TODO: Replace with actual agent address from SDK
      setAgentAddress("0x1234567890abcdef1234567890abcdef12345678")
    }
  }, [])

  const checkAvailability = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ensName.trim()) {
      toast.error("Please enter an ENS name")
      return
    }

    // Validate ENS name format
    const ensRegex = /^[a-z0-9-]+$/
    if (!ensRegex.test(ensName)) {
      toast.error("ENS name can only contain lowercase letters, numbers, and hyphens")
      return
    }

    setStatus("checking")

    try {
      // TODO: Implement actual ENS availability check
      // Example using ENS SDK or ethers.js
      // const provider = new ethers.providers.JsonRpcProvider(...)
      // const resolver = await provider.getResolver(`${ensName}.eth`)

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Simulate random availability (replace with actual check)
      const isAvailable = Math.random() > 0.4

      if (isAvailable) {
        setStatus("available")
        toast.success(`${ensName}.eth is available!`)
      } else {
        setStatus("unavailable")
        toast.error(`${ensName}.eth is already taken`)
      }
    } catch (error) {
      console.error("Error checking ENS availability:", error)
      toast.error("Failed to check ENS availability")
      setStatus("idle")
    }
  }

  const handleRegister = async () => {
    setStatus("registering")

    try {
      // TODO: Implement actual ENS registration
      // This will involve:
      // 1. Connecting to ENS registrar contract
      // 2. Checking registration cost
      // 3. Submitting registration transaction
      // 4. Setting resolver to point to agent address

      // Simulate registration process
      await new Promise(resolve => setTimeout(resolve, 2500))

      setStatus("registered")
      toast.success(`Successfully registered ${ensName}.eth!`)

      // Store ENS name with agent data
      const agentData = localStorage.getItem("agent-data")
      if (agentData) {
        const parsed = JSON.parse(agentData)
        parsed.ensName = `${ensName}.eth`
        localStorage.setItem("agent-data", JSON.stringify(parsed))
      }

      // Wait a moment to show success, then navigate
      setTimeout(() => {
        navigate("/fund-agent")
      }, 1500)

    } catch (error) {
      console.error("Error registering ENS:", error)
      toast.error("Failed to register ENS name")
      setStatus("available")
    }
  }

  const handleSkip = () => {
    navigate("/fund-agent")
  }

  const sanitizeEnsName = (value: string) => {
    // Convert to lowercase and remove invalid characters
    return value.toLowerCase().replace(/[^a-z0-9-]/g, "")
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Setup ENS Name</h1>
          <p className="text-muted-foreground mt-2">
            Give your agent a human-readable identity on the Ethereum blockchain.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Register ENS Name</CardTitle>
            <CardDescription>
              Search for an available .eth name and register it for your agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Agent Address Display */}
            {agentAddress && (
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Agent Wallet Address</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {agentAddress}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      The ENS name will point to this address, making it easier to receive payments.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ENS Search Form */}
            <form onSubmit={checkAvailability} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ens-name">Desired ENS Name</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="ens-name"
                      placeholder="myagent"
                      value={ensName}
                      onChange={(e) => {
                        setEnsName(sanitizeEnsName(e.target.value))
                        if (status !== "idle" && status !== "registering" && status !== "registered") {
                          setStatus("idle")
                        }
                      }}
                      className="pr-16"
                      disabled={status === "registering" || status === "registered"}
                    />
                    <div className="absolute right-3 top-2.5 text-muted-foreground text-sm pointer-events-none">
                      .eth
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={!ensName || status === "checking" || status === "registering" || status === "registered"}
                    variant={status === "available" ? "secondary" : "default"}
                  >
                    {status === "checking" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </div>

              {/* Availability Status */}
              {status === "available" && (
                <div className="flex items-center justify-between p-4 border border-green-500/30 rounded-lg bg-green-500/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {ensName}.eth is available!
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You can register this name for your agent
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {status === "unavailable" && (
                <div className="flex items-center justify-between p-4 border border-red-500/30 rounded-lg bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium text-red-600 dark:text-red-400">
                        {ensName}.eth is already taken
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Try a different name
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {status === "registering" && (
                <div className="flex items-center justify-between p-4 border border-blue-500/30 rounded-lg bg-blue-500/10">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    <div>
                      <p className="font-medium text-blue-600 dark:text-blue-400">
                        Registering {ensName}.eth...
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Please wait while we register your ENS name
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {status === "registered" && (
                <div className="flex items-center justify-between p-4 border border-green-500/30 rounded-lg bg-green-500/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Successfully registered {ensName}.eth!
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Redirecting to fund your agent...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Register Button (shown when available) */}
            {status === "available" && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleRegister}
              >
                Register {ensName}.eth
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* Info Section */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-blue-500">Why register an ENS name?</p>
                  <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                    <li>Human-readable identity instead of a hex address</li>
                    <li>Easier to receive payments and interact with your agent</li>
                    <li>Professional and memorable presence on-chain</li>
                    <li>Can be used across all Ethereum-compatible networks</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Learn more at{" "}
                    <a
                      href="https://docs.ens.domains/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      docs.ens.domains
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <div className="flex justify-between w-full">
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={status === "registering" || status === "registered"}
              >
                Skip for now
              </Button>
              {status === "registered" && (
                <Button onClick={() => navigate("/fund-agent")}>
                  Continue to Funding
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  )
}
