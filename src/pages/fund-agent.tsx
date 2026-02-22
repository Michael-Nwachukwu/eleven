"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Copy, ArrowRight, CheckCircle2, AlertCircle, Wallet, Loader2, ArrowLeft,
  RefreshCw, ChevronRight, Info, Zap, Globe, AlertTriangle
} from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { QRCodeSVG } from "qrcode.react"
import { parseEther } from "viem"

import {
  getMultichainBalances,
  buildDepositPlan,
  executeDepositPlan,
  CHAIN_TOKENS,
} from "@/services/lifi-service"
import type { ChainBalance, DepositPlan, RouteExecution } from "@/types/lifi-types"
import { SUPPORTED_CHAINS } from "@/types/lifi-types"

// ── Small helper components ────────────────────────────────────────────────

function ChainBadge({ chainId }: { chainId: number }) {
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId)
  if (!chain) return null
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: chain.color === '#ffeeda' ? '#c47a2a' : chain.color }}
    >
      {chain.shortName}
    </span>
  )
}

function TokenIcon({ token }: { token: string }) {
  const colors: Record<string, string> = {
    USDC: 'bg-blue-500', USDT: 'bg-green-500', ETH: 'bg-purple-500',
  }
  return (
    <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white ${colors[token] ?? 'bg-gray-400'}`}>
      {token[0]}
    </span>
  )
}

function StatusBadge({ status }: { status: RouteExecution['status'] }) {
  const map: Record<string, { label: string; class: string }> = {
    pending: { label: 'Pending', class: 'bg-muted text-muted-foreground' },
    transferring: { label: 'Transferring…', class: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    approving: { label: 'Approving…', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    swapping: { label: 'Swapping…', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    bridging: { label: 'Bridging…', class: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    done: { label: 'Complete ✓', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    failed: { label: 'Failed ✗', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const s = map[status] ?? map.pending
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.class}`}>{s.label}</span>
}

// ── Main Page ──────────────────────────────────────────────────────────────

type FundingStatus = "pending" | "checking" | "funded"
type DepositMode = "direct" | "smart"

export default function FundAgent() {
  const navigate = useNavigate()
  const { user, linkWallet } = usePrivy()
  const { wallets } = useWallets()
  const { agent, loading: agentLoading } = useAgentWallet()

  // ── Core state ──
  const [fundingStatus, setFundingStatus] = useState<FundingStatus>("pending")
  const [fundingAmount, setFundingAmount] = useState("10")
  const [fundingToken, setFundingToken] = useState<'ETH' | 'USDC'>('USDC')
  const [isTransferring, setIsTransferring] = useState(false)

  // ── Smart deposit state ──
  const [depositMode, setDepositMode] = useState<DepositMode>("direct")
  const [crossChainBalances, setCrossChainBalances] = useState<ChainBalance[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [depositPlan, setDepositPlan] = useState<DepositPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [executions, setExecutions] = useState<RouteExecution[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [confirmedReducedAmount, setConfirmedReducedAmount] = useState(false)

  // ── Constants ──
  const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  const USDC_DECIMALS = 6

  const agentAddress = agent?.agentAddress
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy')

  // ─── Balance polling (funding detection) ─────────────────────────────────
  useEffect(() => {
    if (!agentAddress) return
    const check = async () => {
      try {
        const res = await fetch('https://arb1.arbitrum.io/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [agentAddress, 'latest'], id: 1 }),
        })
        const d = await res.json()
        if (BigInt(d.result || '0') > BigInt(0)) setFundingStatus("funded")
      } catch { /* ignore */ }
    }
    check()
    const iv = setInterval(check, 10000)
    return () => clearInterval(iv)
  }, [agentAddress])

  // ─── Scan cross-chain balances ────────────────────────────────────────────
  const scanBalances = useCallback(async () => {
    if (!externalWallet?.address) {
      toast.error("Connect an external wallet first to scan balances.")
      return
    }
    setLoadingBalances(true)
    setDepositPlan(null)
    setExecutions([])
    try {
      const balances = await getMultichainBalances(externalWallet.address)
      setCrossChainBalances(balances.filter(b => b.balanceUSD > 0.01))
    } catch (err: any) {
      toast.error("Failed to scan balances: " + err.message)
    } finally {
      setLoadingBalances(false)
    }
  }, [externalWallet?.address])

  // Scan automatically when switching to Smart mode
  useEffect(() => {
    if (depositMode === 'smart' && externalWallet?.address && crossChainBalances.length === 0) {
      scanBalances()
    }
  }, [depositMode, externalWallet?.address])

  // ─── Build deposit plan ───────────────────────────────────────────────────
  const buildPlan = useCallback(async () => {
    const amount = parseFloat(fundingAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid deposit amount.")
      return
    }
    if (!agentAddress || !externalWallet?.address) return

    setPlanLoading(true)
    setDepositPlan(null)
    setConfirmedReducedAmount(false)
    try {
      const plan = await buildDepositPlan(
        amount,
        crossChainBalances,
        externalWallet.address,
        agentAddress,
      )
      setDepositPlan(plan)

      if (plan.sources.length === 0 && plan.shortfallUSD > 0) {
        toast.warning("No bridgeable assets found to cover the shortfall on other chains.")
      }
    } catch (err: any) {
      toast.error("Failed to build deposit plan: " + err.message)
    } finally {
      setPlanLoading(false)
    }
  }, [fundingAmount, agentAddress, externalWallet?.address, crossChainBalances])

  // ─── Execute smart deposit ────────────────────────────────────────────────
  const executeSmartDeposit = async () => {
    if (!depositPlan || !externalWallet || !agentAddress) return

    setIsExecuting(true)

    // Build initial execution entries
    const initialExecs: RouteExecution[] = []

    // Entry for the direct Arbitrum transfer (sourceIndex = -1)
    if (depositPlan.existingArbitrumUSD > 0) {
      initialExecs.push({
        sourceIndex: -1,
        chainName: 'Arbitrum',
        token: 'USDC',
        amount: depositPlan.existingArbitrumUSD.toFixed(2),
        status: 'pending',
      })
    }

    // Entries for each LI.FI bridge route
    depositPlan.sources.forEach((s, i) => {
      initialExecs.push({
        sourceIndex: i,
        chainName: s.chainName,
        token: s.token,
        amount: s.amount,
        status: 'pending',
      })
    })

    setExecutions(initialExecs)

    try {
      await executeDepositPlan(
        depositPlan,
        async () => {
          const provider = await externalWallet.getEthereumProvider()
          return provider
        },
        (update) => {
          setExecutions(prev =>
            prev.map(e =>
              e.sourceIndex === update.sourceIndex
                ? {
                  ...e,
                  status: update.status,
                  substep: update.substep,
                  txHash: update.txHash ?? e.txHash,
                  txLink: update.txLink ?? e.txLink,
                  error: update.error,
                }
                : e
            )
          )
        },
        agentAddress,
      )
      toast.success("All routes executed! Funds should arrive on Arbitrum shortly.")
      setTimeout(() => setFundingStatus("checking"), 3000)
    } catch (err: any) {
      toast.error("Execution failed: " + err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  // ─── Direct deposit (existing logic) ─────────────────────────────────────
  const handleDirectDeposit = async () => {
    if (!externalWallet) {
      try { await linkWallet() } catch { /* ignore */ }
      return
    }
    if (!agentAddress) return

    setIsTransferring(true)
    try {
      if (externalWallet.chainId !== 'eip155:42161') {
        try { await externalWallet.switchChain(42161) }
        catch { toast.error("Please switch your wallet to Arbitrum One"); setIsTransferring(false); return }
      }

      const provider = await externalWallet.getEthereumProvider()
      let hash: string

      if (fundingToken === 'ETH') {
        const amountWei = parseEther(fundingAmount)
        hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: externalWallet.address, to: agentAddress, value: `0x${amountWei.toString(16)}` }],
        })
      } else {
        const atomicAmount = BigInt(Math.round(parseFloat(fundingAmount) * 10 ** USDC_DECIMALS))
        const data = `0xa9059cbb${agentAddress.slice(2).padStart(64, '0')}${atomicAmount.toString(16).padStart(64, '0')}`
        hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: externalWallet.address, to: USDC_ADDRESS, data, value: '0x0' }],
        })
      }

      toast.success("Transaction sent!", { description: `Tx: ${hash.slice(0, 18)}…` })
      setTimeout(() => setFundingStatus("checking"), 2000)
    } catch (err: any) {
      toast.error(err.message || "Transaction failed")
    } finally {
      setIsTransferring(false)
    }
  }

  // ─── Utility: total time from plan ───────────────────────────────────────
  const totalTimeMins = depositPlan
    ? Math.ceil(depositPlan.sources.reduce((t, s) => t + s.estimatedTimeSeconds, 0) / 60)
    : 0
  const totalFeesUSD = depositPlan
    ? depositPlan.sources.reduce((f, s) => f + s.estimatedFeesUSD, 0)
    : 0

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (agentLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center space-y-4 pt-20">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">No Agent Found</h2>
          <Button onClick={() => navigate("/create-agent")}>Create Agent</Button>
        </div>
      </DashboardLayout>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-4 pl-0" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fund Your Agent</h1>
            <p className="text-muted-foreground mt-2">
              Deposit USDC to Arbitrum from any supported chain — no manual bridging needed.
            </p>
          </div>
          <Badge
            variant={fundingStatus === "funded" ? "default" : "secondary"}
            className={fundingStatus === "funded" ? "bg-green-500 hover:bg-green-600" : ""}
          >
            {fundingStatus === "funded" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {fundingStatus === "funded" ? "Funded" : fundingStatus === "checking" ? "Checking…" : "Awaiting Funds"}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Left: Deposit Address ── */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" /> Agent Wallet
                </CardTitle>
                <CardDescription>Arbitrum One · USDC target</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="bg-white p-3 rounded-xl shadow-sm border">
                  {agentAddress && <QRCodeSVG value={agentAddress} size={148} />}
                </div>
                <div className="w-full space-y-1">
                  <p className="text-xs text-muted-foreground">Wallet Address</p>
                  <div className="flex gap-2">
                    <Input value={agentAddress || ''} readOnly className="font-mono text-xs bg-muted/50" />
                    <Button variant="outline" size="icon" onClick={() => {
                      navigator.clipboard.writeText(agentAddress ?? '')
                      toast.success("Address copied")
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Funding status card */}
            <Card className={fundingStatus === 'funded' ? "bg-green-500/10 border-green-500/20" : ""}>
              <CardContent className="pt-6 flex flex-col items-center text-center space-y-3">
                {fundingStatus === 'funded' ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-600">Agent Funded!</h3>
                      <p className="text-xs text-muted-foreground">Your agent is ready to operate.</p>
                    </div>
                    <Button onClick={() => navigate("/dashboard")} className="bg-green-600 hover:bg-green-700 w-full">
                      Go to Dashboard
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost" className="w-full"
                    onClick={() => setFundingStatus("checking")}
                    disabled={fundingStatus === 'checking'}
                  >
                    {fundingStatus === 'checking' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify Balance
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Deposit Methods ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Mode Selector */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setDepositMode('direct')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors
                  ${depositMode === 'direct' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted text-muted-foreground'}`}
              >
                <Wallet className="h-4 w-4" /> Direct (Arbitrum)
              </button>
              <button
                onClick={() => setDepositMode('smart')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors
                  ${depositMode === 'smart' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted text-muted-foreground'}`}
              >
                <Globe className="h-4 w-4" /> Smart Multichain
              </button>
            </div>

            {/* ── Direct Deposit ── */}
            {depositMode === 'direct' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Fund from External Wallet</CardTitle>
                  <CardDescription>Transfer ETH or USDC directly on Arbitrum One.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={fundingAmount}
                      onChange={e => setFundingAmount(e.target.value)}
                      className="w-28"
                      step={fundingToken === 'ETH' ? '0.01' : '1'}
                      min="0"
                    />
                    <div className="flex rounded-md border overflow-hidden">
                      {(['USDC', 'ETH'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setFundingToken(t); setFundingAmount(t === 'ETH' ? '0.05' : '10') }}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${fundingToken === t ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleDirectDeposit} disabled={isTransferring}>
                    {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {externalWallet
                      ? `Send ${fundingAmount} ${fundingToken} from ${externalWallet.walletClientType}`
                      : "Connect Wallet to Send"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Make sure your wallet is on <strong>Arbitrum One</strong> (chain ID 42161).
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ── Smart Multichain Deposit ── */}
            {depositMode === 'smart' && (
              <div className="space-y-4">

                {/* Amount + scan */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" /> Smart Deposit
                    </CardTitle>
                    <CardDescription>
                      We scan your wallet on Scroll, Base, Optimism &amp; zkSync and bridge the difference automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          value={fundingAmount}
                          onChange={e => setFundingAmount(e.target.value)}
                          className="pl-7"
                          placeholder="10"
                          min="0"
                        />
                      </div>
                      <Badge variant="outline" className="shrink-0">USDC · Arbitrum</Badge>
                    </div>

                    {!externalWallet ? (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Connect an external wallet to scan cross-chain balances.
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={scanBalances} disabled={loadingBalances}>
                        {loadingBalances
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning balances…</>
                          : <><RefreshCw className="mr-2 h-4 w-4" /> Scan balances on all chains</>}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Balance table */}
                {crossChainBalances.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Detected Balances ({externalWallet?.address?.slice(0, 6)}…{externalWallet?.address?.slice(-4)})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {crossChainBalances.map((b, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <TokenIcon token={b.token} />
                              <div>
                                <p className="text-sm font-medium">{b.balance} {b.token}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <ChainBadge chainId={b.chainId} />
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-semibold">${b.balanceUSD.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Build plan button */}
                {crossChainBalances.length > 0 && !depositPlan && (
                  <Button className="w-full" onClick={buildPlan} disabled={planLoading}>
                    {planLoading
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding best routes…</>
                      : "Find Best Deposit Route"}
                  </Button>
                )}

                {/* Plan Preview */}
                {depositPlan && executions.length === 0 && (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        Route Preview
                        {depositPlan.canCoverFull
                          ? <Badge className="bg-green-500 text-white">Full amount covered</Badge>
                          : <Badge variant="destructive">Partial coverage</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary row */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">You need</p>
                          <p className="font-bold">${depositPlan.depositAmountUSD.toFixed(2)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">On Arbitrum</p>
                          <p className="font-bold text-green-600">${depositPlan.existingArbitrumUSD.toFixed(2)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">Bridging</p>
                          <p className="font-bold text-blue-600">${depositPlan.shortfallUSD.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Partial coverage warning */}
                      {!depositPlan.canCoverFull && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-300">
                              Max spendable: ${depositPlan.maxSpendableUSD.toFixed(2)}
                            </p>
                            <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                              Not enough bridgeable assets to cover $
                              {depositPlan.depositAmountUSD.toFixed(2)}. Proceeding will deposit $
                              {depositPlan.maxSpendableUSD.toFixed(2)} instead.
                            </p>
                            <button
                              className="mt-1 text-xs underline text-amber-700 dark:text-amber-400"
                              onClick={() => {
                                setFundingAmount(depositPlan.maxSpendableUSD.toFixed(2))
                                setConfirmedReducedAmount(true)
                              }}
                            >
                              Accept ${depositPlan.maxSpendableUSD.toFixed(2)} and continue
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Route steps */}
                      {depositPlan.sources.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bridge steps</p>
                          {depositPlan.sources.map((src, i) => (
                            <div key={i} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <TokenIcon token={src.token} />
                                <div>
                                  <p className="text-sm font-medium">${src.amountUSD.toFixed(2)} {src.token}</p>
                                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                    <ChainBadge chainId={src.chainId} />
                                    <ArrowRight className="h-3 w-3" />
                                    <span>USDC · Arbitrum</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <p>~{Math.ceil(src.estimatedTimeSeconds / 60)}m</p>
                                {src.estimatedFeesUSD > 0 && <p className="text-amber-600">${src.estimatedFeesUSD.toFixed(2)} fee</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        depositPlan.existingArbitrumUSD >= depositPlan.depositAmountUSD ? (
                          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            You have enough USDC on Arbitrum — no bridging needed!
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Info className="h-4 w-4" />
                            No bridgeable sources found on other chains.
                          </div>
                        )
                      )}

                      {/* Total cost row */}
                      {depositPlan.sources.length > 0 && (
                        <div className="border-t pt-3 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Estimated total</span>
                          <div className="text-right">
                            <span className="font-semibold">~{totalTimeMins} min</span>
                            {totalFeesUSD > 0 && (
                              <span className="text-muted-foreground ml-2">· ${totalFeesUSD.toFixed(2)} fees</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Execute button */}
                      {(depositPlan.canCoverFull || confirmedReducedAmount) && (
                        <Button className="w-full" onClick={executeSmartDeposit} disabled={isExecuting}>
                          {isExecuting
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing…</>
                            : <>Execute Deposit <ChevronRight className="ml-1 h-4 w-4" /></>}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Execution progress */}
                {executions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Deposit Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {executions.map((e, i) => (
                        <div key={i} className={`rounded-lg px-4 py-3 border transition-all ${e.status === 'done' ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                          : e.status === 'failed' ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800'
                            : e.status === 'pending' ? 'border-muted'
                              : 'border-primary/30 bg-primary/5'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {e.status !== 'pending' && e.status !== 'done' && e.status !== 'failed' && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              )}
                              {e.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                              {e.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
                              {e.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                              <TokenIcon token={e.token} />
                              <div>
                                <p className="text-sm font-medium">${e.amount} {e.token}</p>
                                <p className="text-xs text-muted-foreground">
                                  {e.sourceIndex === -1 ? 'Arbitrum → Agent Wallet' : `${e.chainName} → Arbitrum`}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={e.status} />
                          </div>

                          {/* Substep description */}
                          {e.substep && e.status !== 'pending' && (
                            <p className="mt-2 text-xs text-muted-foreground pl-6">
                              {e.substep}
                            </p>
                          )}

                          {/* Tx link */}
                          {(e.txLink || e.txHash) && (
                            <div className="mt-1 pl-6">
                              <a
                                href={e.txLink || `https://arbiscan.io/tx/${e.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:text-blue-600 underline"
                              >
                                View transaction ↗
                              </a>
                            </div>
                          )}

                          {/* Error */}
                          {e.error && (
                            <p className="mt-1 text-xs text-destructive pl-6">{e.error}</p>
                          )}
                        </div>
                      ))}

                      {executions.every(e => e.status === 'done') && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 pt-2 border-t">
                          <CheckCircle2 className="h-4 w-4" />
                          All deposits complete! Funds should arrive on Arbitrum shortly.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
