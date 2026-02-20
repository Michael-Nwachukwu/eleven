"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Bot, Shield, Zap, Save, Bell, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { usePrivy } from "@privy-io/react-auth"

export default function AgentSettings() {
  const { user } = usePrivy()
  const [isLoading, setIsLoading] = useState(false)
  const [notifEmail, setNotifEmail] = useState('')
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)

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
