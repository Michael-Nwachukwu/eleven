"use client"

import { usePrivy } from "@privy-io/react-auth"
import { Navigate } from "react-router-dom"
import { ArrowRight, Bot, Shield, Zap } from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { authenticated, login } = usePrivy()

  if (authenticated) {
    return <Navigate to="/dashboard" />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm text-primary font-medium mb-4">
              Autonomous Crypto Agents
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Spin up your autonomous <br className="hidden md:block" />
              <span className="text-primary">crypto agent</span> today.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Deploy AI agents that can hold funds, execute payments, and manage strategies on-chain. Fully autonomous,
              fully secure.
            </p>
            <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
              {/* Wrapped login in anonymous function to ensure correct event handling */}
              <Button size="lg" onClick={() => login()} className="text-lg h-12 px-8">
                Connect with Privy <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg h-12 px-8 bg-transparent">
                Read Documentation
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background p-8 rounded-xl border shadow-sm">
                <Bot className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Autonomous Agents</h3>
                <p className="text-muted-foreground">
                  Create agents that operate independently with predefined rules and strategies.
                </p>
              </div>
              <div className="bg-background p-8 rounded-xl border shadow-sm">
                <Zap className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Instant Payments</h3>
                <p className="text-muted-foreground">
                  Seamlessly send and receive payments via QR codes and direct transfers.
                </p>
              </div>
              <div className="bg-background p-8 rounded-xl border shadow-sm">
                <Shield className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
                <p className="text-muted-foreground">
                  Built with Privy for secure authentication and embedded wallet management.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Eleven. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
