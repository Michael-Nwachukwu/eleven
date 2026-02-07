import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QrCode, Send, Scan } from "lucide-react"
import { Link } from "react-router-dom"

export default function Payments() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-2">Send funds directly or use QR codes for instant transactions.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button variant="outline" className="h-24 flex flex-col gap-2 bg-transparent" asChild>
            <Link to="/qr-generator">
              <QrCode className="h-8 w-8" />
              <span>Generate QR</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-24 flex flex-col gap-2 bg-transparent" asChild>
            <Link to="/qr-scanner">
              <Scan className="h-8 w-8" />
              <span>Scan QR</span>
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send Payment</CardTitle>
            <CardDescription>Transfer funds to another wallet or agent</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="direct">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="direct">Direct Transfer</TabsTrigger>
                <TabsTrigger value="recent">Recent Contacts</TabsTrigger>
              </TabsList>

              <TabsContent value="direct" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient</Label>
                  <Input id="recipient" placeholder="0x... or name.eth" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Select defaultValue="usdc">
                      <SelectTrigger>
                        <SelectValue placeholder="Select token" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eth">ETH</SelectItem>
                        <SelectItem value="usdc">USDC</SelectItem>
                        <SelectItem value="dai">DAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select defaultValue="base">
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="base-sepolia">Base Sepolia</SelectItem>
                      <SelectItem value="eth">Ethereum</SelectItem>
                      <SelectItem value="optimism">Optimism</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="recent">
                <div className="text-center py-8 text-muted-foreground">No recent contacts found</div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled>
              <Send className="mr-2 h-4 w-4" /> Send Payment (Coming Soon)
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  )
}
