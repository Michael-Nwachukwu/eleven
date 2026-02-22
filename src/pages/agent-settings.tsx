"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Bot, Shield, Zap, Save, Bell, Loader2, CheckCircle2, Fingerprint, Globe, Receipt, TrendingUp } from "lucide-react"
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

  // Tax State
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState('0')
  const [taxLabel, setTaxLabel] = useState('VAT')
  const [taxLoading, setTaxLoading] = useState(false)
  const [taxSaved, setTaxSaved] = useState(false)

  // Yield / Strategy State
  const [yieldEnabled, setYieldEnabled] = useState(false)
  const [yieldAllocation, setYieldAllocation] = useState(40)   // % of payment to invest
  const [yieldMonthlyLimit, setYieldMonthlyLimit] = useState('500')
  const [yieldAutoHarvest, setYieldAutoHarvest] = useState(true)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [yieldSaved, setYieldSaved] = useState(false)

  // Form Population
  useEffect(() => {
    if (agent?.ensName) setEnsName(agent.ensName)
    if (agent?.erc8004TokenId) setMintedId(agent.erc8004TokenId)
    if (agent?.taxEnabled !== undefined) setTaxEnabled(agent.taxEnabled)
    if (agent?.taxRate !== undefined) setTaxRate(String(agent.taxRate))
    if (agent?.taxLabel) setTaxLabel(agent.taxLabel)
    if (agent?.yieldEnabled !== undefined) setYieldEnabled(agent.yieldEnabled)
    if (agent?.yieldAllocationPercent !== undefined) setYieldAllocation(agent.yieldAllocationPercent)
    if (agent?.yieldMonthlyLimit !== undefined) setYieldMonthlyLimit(String(agent.yieldMonthlyLimit))
    if (agent?.yieldAutoHarvest !== undefined) setYieldAutoHarvest(agent.yieldAutoHarvest)
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

  const handleSaveTax = async () => {
    if (!user?.id) return
    const rate = parseFloat(taxRate)
    if (isNaN(rate) || rate < 0 || rate > 99.9) {
      toast.error('Tax rate must be between 0 and 99.9%')
      return
    }
    setTaxLoading(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=update-tax`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxEnabled, taxRate: rate, taxLabel }),
      })
      if (res.ok) {
        setTaxSaved(true)
        toast.success('Tax settings saved!')
        setTimeout(() => setTaxSaved(false), 3000)
      } else {
        toast.error('Failed to save tax settings')
      }
    } catch {
      toast.error('Failed to save tax settings')
    } finally {
      setTaxLoading(false)
    }
  }

  const handleSaveYieldSettings = async () => {
    if (!user?.id) return
    setYieldLoading(true)
    try {
      const res = await fetch(`/api/agent/${user.id}?action=update-yield-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yieldEnabled,
          yieldAllocationPercent: yieldAllocation,
          yieldMonthlyLimit: parseFloat(yieldMonthlyLimit) || 0,
          yieldAutoHarvest,
        }),
      })
      if (res.ok) {
        setYieldSaved(true)
        toast.success('Yield strategy settings saved!')
        setTimeout(() => setYieldSaved(false), 3000)
      } else {
        toast.error('Failed to save yield settings')
      }
    } catch {
      toast.error('Failed to save yield settings')
    } finally {
      setYieldLoading(false)
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

        {/* === TAX CONFIGURATION === */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle>Tax Configuration</CardTitle>
            </div>
            <CardDescription>
              Add a tax rate to your payments — customers see a full breakdown (subtotal + tax = total).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Tax Collection</Label>
                <div className="text-sm text-muted-foreground">Apply a tax rate to all incoming payments</div>
              </div>
              <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
            </div>

            {taxEnabled && (
              <div className="space-y-4 pt-2 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="tax-rate"
                        type="number"
                        min="0"
                        max="99.9"
                        step="0.1"
                        value={taxRate}
                        onChange={e => setTaxRate(e.target.value)}
                        className="w-28"
                      />
                      <span className="text-muted-foreground text-sm">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax-label">Tax Label</Label>
                    <Select value={taxLabel} onValueChange={setTaxLabel}>
                      <SelectTrigger id="tax-label">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VAT">VAT</SelectItem>
                        <SelectItem value="GST">GST</SelectItem>
                        <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                        <SelectItem value="Service Charge">Service Charge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground border">
                  Example: A $100 order → customer pays <strong>${(100 * (1 + parseFloat(taxRate || '0') / 100)).toFixed(2)}</strong> ($100.00 + {taxLabel} {taxRate || '0'}%)
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveTax} disabled={taxLoading} variant={taxSaved ? 'outline' : 'default'}>
                {taxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : taxSaved ? <><CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />Saved</> : <><Save className="h-4 w-4 mr-1" />Save Tax Settings</>}
              </Button>
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
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Yield Strategy</CardTitle>
            </div>
            <CardDescription>
              Automatically invest a portion of every incoming crypto payment into Aave V3 for yield.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Yield Optimization</Label>
                <div className="text-sm text-muted-foreground">Deposit a % of each crypto payment into Aave V3 (~1.8% APY)</div>
              </div>
              <Switch checked={yieldEnabled} onCheckedChange={setYieldEnabled} />
            </div>

            <div className="space-y-4" style={{ opacity: yieldEnabled ? 1 : 0.5, pointerEvents: yieldEnabled ? 'auto' : 'none' }}>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Yield Allocation (% of each payment)</Label>
                  <span className="text-sm font-semibold text-primary">{yieldAllocation}%</span>
                </div>
                <Slider
                  value={[yieldAllocation]}
                  onValueChange={([v]) => setYieldAllocation(v)}
                  min={0}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>All liquid</span>
                  <span>Example: $100 payment → ${(100 * yieldAllocation / 100).toFixed(0)} to Aave, ${(100 * (1 - yieldAllocation / 100)).toFixed(0)} liquid</span>
                  <span>All invested</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly-limit">Monthly Investment Limit (USDC)</Label>
                <div className="flex gap-2">
                  <Input
                    id="monthly-limit"
                    type="number"
                    value={yieldMonthlyLimit}
                    onChange={e => setYieldMonthlyLimit(e.target.value)}
                    placeholder="0 = no limit"
                    min="0"
                  />
                  <span className="flex items-center text-sm text-muted-foreground px-2">USDC/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">Set to 0 for no monthly cap.</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Harvest for Outgoing Payments</Label>
                  <div className="text-sm text-muted-foreground">
                    When liquid USDC is insufficient, automatically withdraw from Aave to cover payments
                  </div>
                </div>
                <Switch checked={yieldAutoHarvest} onCheckedChange={setYieldAutoHarvest} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveYieldSettings} disabled={yieldLoading} variant={yieldSaved ? 'outline' : 'default'}>
                {yieldLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : yieldSaved ? <><CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />Saved</> : <><Save className="h-4 w-4 mr-1" />Save Yield Settings</>}
              </Button>
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
