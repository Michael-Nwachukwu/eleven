"use client"

import { usePrivy } from "@privy-io/react-auth"
import { Navigate } from "react-router-dom"
import { ArrowRight, Bot, Shield, Zap, QrCode, Globe, CreditCard, Mail, Fingerprint } from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { authenticated, login } = usePrivy()

  if (authenticated) {
    return <Navigate to="/dashboard" />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans selection:bg-primary/20">
      <Navbar />

      <main className="flex-1 overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute top-[20%] right-[-10%] w-[30%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[30%] rounded-full bg-violet-500/10 blur-[120px]" />
        </div>

        {/* Hero Section */}
        <section className="relative pt-24 pb-32 md:pt-36 md:pb-40 px-4 text-center">
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            <div className="mx-auto inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary font-medium mb-6 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              The Future of Payments is Autonomous
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Programmable Crypto <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-violet-500">
                via AI Agents.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Accept payments from humans and AI agents via one QR code.
              Verifiable agent identities with ENS. Instant, self-custodial settlement on Arbitrum.
            </p>

            <div className="pt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" onClick={() => login()} className="text-lg h-14 px-10 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-1">
                Connect with Privy <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg h-14 px-10 rounded-full bg-background/50 backdrop-blur-sm border-muted-foreground/20 hover:bg-muted transition-all">
                Read Documentation
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-muted/30 border-y border-border/50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Everything you need to scale</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Eleven combines agentic wallets, multichain bridging, and fiat settlement into one seamless API and dashboard.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Feature 1 */}
              <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI Agent Wallets</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Non-custodial smart EOAs provisioned on Arbitrum via Thirdweb Agent Kit. Your agent signs and routes payments autonomously.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-blue-500/50 transition-all group">
                <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all">
                  <Globe className="h-7 w-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Multichain Deposits</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Powered by LI.FI SDK. Deposit from Base, Optimism, Scroll, or zkSync and seamlessly auto-bridge to your Arbitrum agent.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-violet-500/50 transition-all group">
                <div className="h-14 w-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6 group-hover:bg-violet-500/20 group-hover:scale-110 transition-all">
                  <QrCode className="h-7 w-7 text-violet-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">x402 QR Payments</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate EIP-compliant signed payment URIs. Not just for humans—other AI agents can parse these schemas to autonomously execute payments to your merchant node.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all">
                  <CreditCard className="h-7 w-7 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Fiat Settlement</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Accept local bank transfers via Aeon's fiat-crypto bridge. Settled directly into USDC on Arbitrum.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all group">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all">
                  <Mail className="h-7 w-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Automated Receipts</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Beautiful, transactional HTML emails sent to payers automatically via Resend upon successful payment.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-rose-500/50 transition-all group">
                <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6 group-hover:bg-rose-500/20 group-hover:scale-110 transition-all">
                  <Fingerprint className="h-7 w-7 text-rose-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Agent Identity & ENS</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Give your agent a verifiable ERC-8004 identity and a human-readable ENS subdomain like <code className="text-xs bg-muted px-1 py-0.5 rounded">mystore.0xkitchens.eth</code>. Discoverable by other agents and humans.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-24 px-4 bg-background relative overflow-hidden">
          {/* Subtle texture/gradient */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">How it works</h2>
              <p className="text-lg text-muted-foreground">From onboarding to your first payment in minutes.</p>
            </div>

            <div className="grid md:grid-cols-4 gap-8 md:gap-4 relative">
              {/* Connector line (Desktop only) */}
              <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-[2px] bg-border z-0" />

              {[
                { step: "01", title: "Create Agent", desc: "Sign in with Privy and claim your ENS subdomain to provision your on-chain agent." },
                { step: "02", title: "Generate QR", desc: "Create a signed x402 payment link for crypto or fiat — your ENS name is embedded." },
                { step: "03", title: "Customer Pays", desc: "Users scan and pay via USDC, ETH, or local Bank Transfer — they see your ENS identity." },
                { step: "04", title: "Instant Settlement", desc: "Funds land directly in your agent wallet on Arbitrum. Fully verifiable." }
              ].map((item, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center space-y-5 px-2">
                  <div className="w-24 h-24 rounded-full bg-background border-4 border-muted flex items-center justify-center shadow-lg group hover:border-primary/50 transition-all">
                    <span className="text-3xl font-extrabold text-muted-foreground/30 group-hover:text-primary transition-colors">{item.step}</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 -z-10"></div>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

          <div className="max-w-4xl mx-auto text-center space-y-10 relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Ready to modernize <br className="hidden md:block" /> your payments?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join the next generation of merchants accepting programmable, borderless money with zero hidden fees.
            </p>
            <Button size="lg" onClick={() => login()} className="text-lg h-16 px-12 rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-1">
              Create Your Agent Wallet
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-muted-foreground">
          <div className="flex items-center space-x-3 mb-6 md:mb-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-foreground text-xl tracking-tight">Eleven</span>
          </div>

          <p className="text-sm">© 2026 Eleven. All rights reserved.</p>

          <div className="flex space-x-6 mt-6 md:mt-0 text-sm font-medium">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
