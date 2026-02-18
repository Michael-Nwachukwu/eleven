"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft, Download, Copy, ExternalLink, Loader2, Share2,
    QrCode, Users, DollarSign, TrendingUp, Calendar
} from "lucide-react"
import { Link, useParams, Navigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { usePrivy } from "@privy-io/react-auth"
import QRCode from "qrcode"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { PaymentOrder, PaymentFulfillment } from "@/lib/db"

export default function OrderDetail() {
    const { orderId } = useParams<{ orderId: string }>()
    const { authenticated, ready } = usePrivy()

    const [order, setOrder] = useState<PaymentOrder | null>(null)
    const [fulfillments, setFulfillments] = useState<PaymentFulfillment[]>([])
    const [loading, setLoading] = useState(true)
    const [qrDataUrl, setQrDataUrl] = useState("")
    const qrCanvasRef = useRef<HTMLCanvasElement>(null)

    // Auth check
    if (ready && !authenticated) {
        return <Navigate to="/" />
    }

    // Fetch order data
    useEffect(() => {
        if (!orderId) return

        const fetchOrder = async () => {
            setLoading(true)
            try {
                const response = await fetch(`/api/payment/order/${orderId}`)
                if (response.ok) {
                    const data = await response.json()
                    setOrder(data.order)
                    setFulfillments(data.fulfillments || [])
                } else {
                    toast.error("Failed to load order")
                }
            } catch (error) {
                console.error("Error fetching order:", error)
                toast.error("Failed to load order")
            } finally {
                setLoading(false)
            }
        }

        fetchOrder()
    }, [orderId])

    // Generate QR code when order loads
    useEffect(() => {
        if (!order?.x402Uri) return

        QRCode.toDataURL(order.x402Uri, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' },
        }).then(url => setQrDataUrl(url))
            .catch(err => console.error("QR generation error:", err))
    }, [order?.x402Uri])

    // Build chart data from fulfillments
    const chartData = fulfillments
        .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())
        .reduce((acc: { date: string; amount: number; cumulative: number }[], f, i) => {
            const prev = acc[acc.length - 1]?.cumulative || 0
            const amount = parseFloat(f.amount) || 0
            acc.push({
                date: new Date(f.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                amount,
                cumulative: prev + amount,
            })
            return acc
        }, [])

    const totalCollected = parseFloat(order?.totalCollected || '0')
    const amountRequested = parseFloat(order?.amount || '0')
    const remaining = Math.max(0, amountRequested - totalCollected)
    const progressPct = amountRequested > 0 ? Math.min(100, (totalCollected / amountRequested) * 100) : 0

    const handleDownloadQR = () => {
        if (!qrDataUrl) return
        const link = document.createElement('a')
        link.href = qrDataUrl
        link.download = `order-${orderId}-qr.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("QR code downloaded!")
    }

    const handleCopyUri = () => {
        if (!order?.x402Uri) {
            toast.error("No payment URI available")
            return
        }
        navigator.clipboard.writeText(order.x402Uri)
        toast.success("Payment URI copied!")
    }

    const handleCopyPaymentLink = () => {
        if (!order?.x402Uri) {
            toast.error("No payment URI available")
            return
        }
        const paymentData = order.x402Uri.replace('x402://', '')
        const link = `${window.location.origin}/pay/${paymentData}`
        navigator.clipboard.writeText(link)
        toast.success("Payment link copied!")
    }

    const handleShare = async () => {
        if (!order?.x402Uri) return
        const paymentData = order.x402Uri.replace('x402://', '')
        const link = `${window.location.origin}/pay/${paymentData}`
        const displayAmount = order.mode === 'crypto'
            ? `${order.amount} ${order.token}`
            : `₦${parseFloat(order.amount).toLocaleString()}`

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Payment: ${displayAmount}`,
                    text: `Pay ${displayAmount} via Zap`,
                    url: link,
                })
            } else {
                await navigator.clipboard.writeText(link)
                toast.success("Payment link copied!")
            }
        } catch {
            await navigator.clipboard.writeText(link)
            toast.success("Payment link copied!")
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        )
    }

    if (!order) {
        return (
            <DashboardLayout>
                <div className="max-w-3xl mx-auto text-center py-16">
                    <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
                    <p className="text-muted-foreground mb-6">This payment order doesn't exist or has been removed.</p>
                    <Button asChild>
                        <Link to="/payments">Back to Orders</Link>
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    const isCrypto = order.mode === 'crypto'
    const symbol = isCrypto ? order.token : '₦'
    const displayAmount = isCrypto ? `${order.amount} ${order.token}` : `₦${parseFloat(order.amount).toLocaleString()}`

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto pb-12">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/payments" className="text-muted-foreground hover:text-foreground flex items-center mb-4 text-sm">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Orders
                    </Link>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{order.description || "Payment Order"}</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Created {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                            </p>
                        </div>
                        <Badge
                            variant={order.status === 'active' ? 'default' : order.status === 'completed' ? 'secondary' : 'destructive'}
                            className="text-xs"
                        >
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Left: QR Code */}
                    <Card className="md:row-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <QrCode className="h-4 w-4" /> Payment QR
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center space-y-4">
                            {qrDataUrl ? (
                                <>
                                    <div className="bg-white rounded-xl p-3 shadow-sm border">
                                        <img src={qrDataUrl} alt="Payment QR Code" className="w-48 h-48" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                                            <Download className="h-3.5 w-3.5 mr-1.5" /> Save
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleShare}>
                                            <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
                                        </Button>
                                    </div>

                                    <div className="w-full space-y-2">
                                        <Button variant="ghost" size="sm" className="w-full text-xs justify-start" onClick={handleCopyPaymentLink}>
                                            <Copy className="h-3 w-3 mr-1.5" /> Copy Payment Link
                                        </Button>
                                        <Button variant="ghost" size="sm" className="w-full text-xs justify-start" onClick={handleCopyUri}>
                                            <Copy className="h-3 w-3 mr-1.5" /> Copy x402 URI
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="w-48 h-48 rounded-xl border border-dashed bg-muted/30 flex flex-col items-center justify-center text-center p-4">
                                    <QrCode className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                    <p className="text-xs text-muted-foreground">
                                        QR code unavailable.
                                        <br />
                                        Generate a new one from the QR Generator.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right Top: Payment Summary Stats */}
                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="flex items-center gap-2 text-blue-500 mb-1">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    <span className="text-[10px] uppercase tracking-wider font-medium">Requested</span>
                                </div>
                                <div className="text-lg font-bold">{displayAmount}</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="flex items-center gap-2 text-green-500 mb-1">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    <span className="text-[10px] uppercase tracking-wider font-medium">Collected</span>
                                </div>
                                <div className="text-lg font-bold">
                                    {isCrypto ? `${totalCollected.toFixed(2)} ${order.token}` : `₦${totalCollected.toLocaleString()}`}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Users className="h-3.5 w-3.5" />
                                    <span className="text-[10px] uppercase tracking-wider font-medium">Payments</span>
                                </div>
                                <div className="text-lg font-bold">{order.fulfillmentCount}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4 pb-3 px-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="text-[10px] uppercase tracking-wider font-medium">Mode</span>
                                </div>
                                <div className="text-lg font-bold capitalize">{order.mode}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Progress bar */}
                    <Card className="md:col-span-2">
                        <CardContent className="pt-4 pb-3 px-4 space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Collection Progress</span>
                                <span>{progressPct.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                    className="bg-gradient-to-r from-green-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-green-500 font-medium">
                                    {isCrypto ? totalCollected.toFixed(2) : totalCollected.toLocaleString()} collected
                                </span>
                                <span className="text-muted-foreground">
                                    {isCrypto ? remaining.toFixed(2) : remaining.toLocaleString()} remaining
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Revenue Chart */}
                {chartData.length > 1 && (
                    <Card className="mt-6">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Revenue Over Time</CardTitle>
                            <CardDescription>Cumulative payments received</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                                        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--background))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                            }}
                                            formatter={(value: number) => [`${value.toFixed(2)} ${order.token}`, 'Total']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="cumulative"
                                            stroke="hsl(142, 76%, 36%)"
                                            fillOpacity={1}
                                            fill="url(#colorRevenue)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Fulfillments List */}
                <Card className="mt-6">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Payments Received</CardTitle>
                                <CardDescription>{fulfillments.length} payment{fulfillments.length !== 1 ? 's' : ''}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {fulfillments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="font-medium">No payments yet</p>
                                <p className="text-sm mt-1">Share the QR code or payment link to start receiving payments.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {fulfillments.map(f => (
                                    <div
                                        key={f.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 text-xs font-bold">
                                                {(f.payerName || 'A').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{f.payerName || "Anonymous"}</div>
                                                <div className="text-xs text-muted-foreground">{f.payerEmail || "No email"}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="font-semibold text-green-500 text-sm">
                                                    +{f.amount} {order.token}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {new Date(f.paidAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                            {f.transactionHash && (
                                                <a
                                                    href={`https://arbiscan.io/tx/${f.transactionHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
