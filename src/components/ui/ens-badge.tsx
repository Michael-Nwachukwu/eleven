import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle } from "lucide-react"

interface EnsBadgeProps {
  status: "available" | "unavailable" | "checking" | "registered"
}

export function EnsBadge({ status }: EnsBadgeProps) {
  if (status === "checking") {
    return (
      <Badge variant="outline" className="animate-pulse">
        Checking...
      </Badge>
    )
  }

  if (status === "available") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Available
      </Badge>
    )
  }

  if (status === "registered") {
    return (
      <Badge variant="secondary">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Owned
      </Badge>
    )
  }

  return (
    <Badge variant="destructive">
      <XCircle className="w-3 h-3 mr-1" /> Unavailable
    </Badge>
  )
}
