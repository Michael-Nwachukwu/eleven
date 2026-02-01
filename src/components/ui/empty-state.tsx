"use client"

import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl border-dashed bg-muted/10 h-[400px]">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-8">{description}</p>
      <Button onClick={onAction} size="lg">
        {actionLabel}
      </Button>
    </div>
  )
}
