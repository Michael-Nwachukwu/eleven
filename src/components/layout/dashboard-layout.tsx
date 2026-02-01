import type React from "react"
import { Navbar } from "./navbar"
import { Sidebar } from "./sidebar"
import { usePrivy } from "@privy-io/react-auth"
import { Navigate } from "react-router-dom"
import { Loader2 } from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { ready, authenticated } = usePrivy()

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (ready && !authenticated) {
    return <Navigate to="/" />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
