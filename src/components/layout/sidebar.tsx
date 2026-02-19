import type React from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, PlusCircle, CreditCard, QrCode, Settings, TrendingUp, Wallet } from "lucide-react"
import elevenLogo from "@/assets/eleven-logo-blue.png"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation()
  const pathname = location.pathname

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
    },
    {
      label: "Create Agent",
      icon: PlusCircle,
      href: "/create-agent",
      active: pathname === "/create-agent",
    },
    {
      label: "Fund Agent",
      icon: Wallet,
      href: "/fund-agent",
      active: pathname === "/fund-agent",
    },
    {
      label: "Orders",
      icon: CreditCard,
      href: "/payments",
      active: pathname === "/payments" || pathname === "/payment-review" || pathname === "/payment-success",
    },
    {
      label: "QR Generator",
      icon: QrCode,
      href: "/qr-generator",
      active: pathname === "/qr-generator",
    },
    {
      label: "Strategies",
      icon: TrendingUp,
      href: "/strategies",
      active: pathname === "/strategies",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/agent-settings",
      active: pathname === "/agent-settings",
    },
  ]

  return (
    <div className={cn("pb-12 w-64 border-r bg-background hidden md:block", className)}>
      <div className="space-y-4 py-4">
       
        <div className="px-3 py-2">
          <div className="space-y-1">
            {routes.map((route) => (
              <Button
                key={route.href}
                variant={route.active ? "secondary" : "ghost"}
                className="w-full justify-start"
                asChild
              >
                <Link to={route.href}>
                  <route.icon className="mr-2 h-4 w-4" />
                  {route.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
