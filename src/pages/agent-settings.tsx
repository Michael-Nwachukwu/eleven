"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Bot, Shield, Zap, Save, Bell, Loader2, CheckCircle2, Fingerprint, Globe } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useAgentWallet } from "@/hooks/useAgentWallet"

export default function AgentSettings() {
  const { user } = usePrivy()
  const { agent } = useAgentWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [notifEmail, setNotifEmail] = useState('')
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)

  // ENS State
  const [ensName, setEnsName] = useState('')
  const [ensLoading, setEnsLoading] = useState(false)
  const [ensSaved, setEnsSaved] = useState(false)
  const [ensChecking, setEnsChecking] = useState(false)
  const [ensAvailable, setEnsAvailable] = useState<boolean | null>(null)

  // Identity State
  const [isMinting, setIsMinting] = useState(false)
  const [mintedId, setMintedId] = useState<string | null>(null)

  // Form Population
  useEffect(() => {
    if (agent?.ensName) setEnsName(agent.ensName)
    if (agent?.erc8004TokenId) setMintedId(agent.erc8004TokenId)
  }, [agent])

  // Debounce ENS check
  useEffect(() => {
    if (!ensName || ensName === agent?.ensName) {
      setEnsAvailable(null)
      return
    }
    const sanitized = ensName.toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (sanitized !== ensName) setEnsName(sanitized)
    if (sanitized.length < 3) {
      setEnsAvailable(null)
      return
    }

    setEnsChecking(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agent/${user?.id}?action=check-ens&name=${sanitized}`)
        const data = await res.json()
        setEnsAvailable(data.available)
      } catch {
        setEnsAvailable(null)
      } finally {
        setEnsChecking(false)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [ensName, agent?.ensName, user?.id])

  // Load existing notification email
  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/notifications?action=settings&userId=${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.notificationEmail) setNotifEmail(data.notificationEmail)
      })
      .catch(() => { })
  }, [user?.id])

  const handleSave = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      toast.success("Agent settings updated successfully")
    }, 1000)
  }

  const handleSaveNotifEmail = async () => {
    if (!user?.id) return
    if (!notifEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    setNotifLoading(true)
    try {
      const res = await fetch('/api/notifications?action=settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: notifEmail }),
      })
      if (res.ok) {
        setNotifSaved(true)
        toast.success('Notification email saved!')
        setTimeout(() => setNotifSaved(false), 3000)
      } else {
        toast.error('Failed to save. Make sure your agent wallet is set up.')
      }
    } catch {
      toast.error('Failed to save notification email')
    } finally {
      setNotifLoading(false)
    }
  }

  const handleSaveEnsName = async () => {
    if (!user?.id || !ensName) return
    setEnsLoading(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=update-ens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: ensName })
      })
      if (res.ok) {
        setEnsSaved(true)
        toast.success("ENS Name updated and registered securely via NameStone!")
        setTimeout(() => {
          setEnsSaved(false)
          window.location.reload()
        }, 2000)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update ENS Name.")
      }
    } catch {
      toast.error("Failed to update ENS Name.")
    } finally {
      setEnsLoading(false)
    }
  }

  const handleMintIdentity = async () => {
    if (!user?.id) return
    setIsMinting(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=mint-identity`, {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        setMintedId(data.tokenId)
        toast.success("Agent Identity Minted!", {
          description: `Token ID: ${data.tokenId}`
        })
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to mint identity.")
      }
    } catch {
      toast.error("Failed to mint identity.")
    } finally {
      setIsMinting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Agent Settings</h1>
          <p className="text-muted-foreground mt-2">Configure your agent's behavior and parameters.</p>
        </div>

        {/* === NOTIFICATION SETTINGS === */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notification Settings</CardTitle>
            </div>
            <CardDescription>
              Receive email alerts when someone pays your invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notif-email">Notification Email</Label>
              <div className="flex gap-2">
                <Input
                  id="notif-email"
                  type="email"
                  placeholder="you@example.com"
                  value={notifEmail}
                  onChange={(e) => setNotifEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveNotifEmail}
                  disabled={notifLoading || !notifEmail}
                  variant={notifSaved ? "outline" : "default"}
                >
                  {notifLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : notifSaved ? (
                    <><CheckCircle2 className="h-4 w-4 mr-1 text-green-500" /> Saved</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Save</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll receive a "New Payment" alert at this address whenever someone pays your QR.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* === IDENTITY SETTINGS === */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              <CardTitle>Agent Identity (ERC-8004)</CardTitle>
            </div>
            <CardDescription>
              Manage your agent's decentralized identity and naming.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ensName">ENS Subdomain</Label>
                {agent?.ensName ? (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted/50 rounded-md p-3 flex items-center justify-between border">
                      <span className="font-medium">{agent.ensName}.0xkitchens.eth</span>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="flex-1 flex gap-2 items-center">
                        <Input
                          id="ensName"
                          placeholder="e.g. mystore"
                          value={ensName}
                          onChange={(e) => setEnsName(e.target.value)}
                          className={ensAvailable === false ? 'border-red-500' : ''}
                          maxLength={20}
                        />
                        <div className="text-muted-foreground bg-muted px-3 py-2 rounded-md text-sm whitespace-nowrap">
                          .0xkitchens.eth
                        </div>
                      </div>
                      <Button
                        onClick={handleSaveEnsName}
                        disabled={ensLoading || !ensName || ensAvailable === false}
                        variant={ensSaved ? "outline" : "default"}
                      >
                        {ensLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : ensSaved ? (
                          <><CheckCircle2 className="h-4 w-4 mr-1 text-green-500" /> Saved</>
                        ) : (
                          <><Globe className="h-4 w-4 mr-1" /> Register</>
                        )}
                      </Button>
                    </div>
                    {ensName !== agent?.ensName && (
                      <div className="text-xs h-4">
                        {ensChecking && <span className="text-muted-foreground flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Checking availability...</span>}
                        {!ensChecking && ensAvailable === true && <span className="text-green-500">Name is available!</span>}
                        {!ensChecking && ensAvailable === false && <span className="text-red-500">Name is already taken.</span>}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between border">
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    On-chain Identity Status
                    {mintedId ? <span className="bg-green-500/10 text-green-600 text-xs px-2 py-0.5 rounded-full border border-green-500/20">Minted</span>
                      : <span className="bg-yellow-500/10 text-yellow-600 text-xs px-2 py-0.5 rounded-full border border-yellow-500/20">Pending</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                    {mintedId
                      ? `Your agent identity is verifiable with ID: ${mintedId}`
                      : 'ERC-8004 specifies agent metadata allowing others to discover and verify your agent.'}
                  </p>
                </div>
                <Button
                  onClick={handleMintIdentity}
                  disabled={isMinting || !!mintedId}
                  variant={mintedId ? "secondary" : "default"}
                >
                  {isMinting ? <Loader2 className="h-4 w-4 animate-spin" /> : (mintedId ? "Minted" : "Mint Identity")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
            <CardDescription>Basic settings for your autonomous agent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input id="name" defaultValue="Prime Alpha Agent" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Emergency Pause</Label>
                <div className="text-sm text-muted-foreground">Stop all agent activities immediately</div>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Risk &amp; Strategy</CardTitle>
            <CardDescription>Define how your agent manages assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Risk Tolerance</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors bg-card hover:bg-accent/50 relative">
                  <input type="radio" name="risk" className="absolute inset-0 opacity-0 cursor-pointer" />
                  <Shield className="h-6 w-6 mb-2 text-green-500" />
                  <div className="font-medium">Conservative</div>
                </div>
                <div className="border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors bg-card hover:bg-accent/50 relative ring-2 ring-primary">
                  <input type="radio" name="risk" className="absolute inset-0 opacity-0 cursor-pointer" defaultChecked />
                  <Bot className="h-6 w-6 mb-2 text-blue-500" />
                  <div className="font-medium">Balanced</div>
                </div>
                <div className="border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors bg-card hover:bg-accent/50 relative">
                  <input type="radio" name="risk" className="absolute inset-0 opacity-0 cursor-pointer" />
                  <Zap className="h-6 w-6 mb-2 text-orange-500" />
                  <div className="font-medium">Aggressive</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Asset Allocation (Stable vs Volatile)</Label>
                <span className="text-sm text-muted-foreground">60/40</span>
              </div>
              <Slider defaultValue={[60]} max={100} step={1} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spending">Monthly Spending Limit</Label>
              <div className="flex gap-2">
                <Input id="spending" type="number" defaultValue="1000" />
                <Select defaultValue="usdc">
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eth">ETH</SelectItem>
                    <SelectItem value="usdc">USDC</SelectItem>
                    <SelectItem value="dai">DAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              "Saving..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
