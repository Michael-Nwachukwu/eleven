import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink, Bot } from "lucide-react"
import { Link } from "react-router-dom"

interface AgentCardProps {
  name?: string
  address: string
  balance: string
  status: "active" | "inactive" | "deploying"
}

export function AgentCard({ name, address, balance, status }: AgentCardProps) {
  const statusColors = {
    active: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    inactive: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
    deploying: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">{name || "Unnamed Agent"}</CardTitle>
            <CardDescription className="font-mono text-xs truncate max-w-[200px]">{address}</CardDescription>
          </div>
        </div>
        <Badge variant="outline" className={statusColors[status]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="mt-4 space-y-2">
          <div className="text-sm text-muted-foreground">Total Balance</div>
          <div className="text-3xl font-bold">{balance} ETH</div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <Button variant="outline" size="sm" className="flex-1 bg-transparent">
          <Copy className="mr-2 h-4 w-4" /> Copy Address
        </Button>
        <Button size="sm" className="flex-1" asChild>
          <Link to="/payments">
            Send Funds <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
