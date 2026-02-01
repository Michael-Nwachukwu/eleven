import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

interface SuccessStateProps {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function SuccessState({
  title,
  description,
  actionLabel = "Return to Dashboard",
  actionHref = "/dashboard",
}: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>
      <h2 className="text-3xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-8 text-lg">{description}</p>
      <Button size="lg" asChild>
        <Link to={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  )
}
