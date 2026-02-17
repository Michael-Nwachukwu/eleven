"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Send, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useAgentWallet } from "@/hooks/useAgentWallet"
import { getAgentWallet } from "@/services/thirdweb-agent-service"
import { prepareContractCall, sendTransaction, getContract, readContract, waitForReceipt } from "thirdweb"
import { thirdwebClient } from "@/services/thirdweb-agent-service"
import { arbitrum } from "thirdweb/chains"
import { parseUnits, formatUnits } from "viem"
import { usePrivy } from "@privy-io/react-auth"

type TokenSymbol = "USDC" | "ETH"

// Token addresses on Arbitrum
const TOKEN_ADDRESSES: Record<TokenSymbol, string> = {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    ETH: "0x0000000000000000000000000000000000000000",
}

interface SendModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function SendModal({ open, onOpenChange, onSuccess }: SendModalProps) {
    const { agent } = useAgentWallet()
    const { user } = usePrivy()

    const [recipient, setRecipient] = useState("")
    const [amount, setAmount] = useState("")
    const [token, setToken] = useState<TokenSymbol>("USDC")
    const [isSending, setIsSending] = useState(false)
    const [lastTxHash, setLastTxHash] = useState<string>("")

    // Balances
    const [usdcBalance, setUsdcBalance] = useState<string>("0.00")
    const [ethBalance, setEthBalance] = useState<string>("0.00")
    const [loadingBalances, setLoadingBalances] = useState(false)

    // Load balances when open
    useEffect(() => {
        if (open && agent?.agentAddress) {
            loadBalances()
            // Reset state
            setRecipient("")
            setAmount("")
            setLastTxHash("")
            setIsSending(false)
        }
    }, [open, agent?.agentAddress])

    const loadBalances = async () => {
        if (!agent?.agentAddress) return
        setLoadingBalances(true)

        try {
            // Get USDC balance
            const usdcContract = getContract({
                client: thirdwebClient,
                address: TOKEN_ADDRESSES.USDC,
                chain: arbitrum,
            })

            const usdcBal = await readContract({
                contract: usdcContract,
                method: "function balanceOf(address account) view returns (uint256)",
                params: [agent.agentAddress as `0x${string}`],
            })
            setUsdcBalance(formatUnits(usdcBal, 6))

            // Get ETH balance via RPC
            const rpcUrl = "https://arb1.arbitrum.io/rpc"
            const ethBalResponse = await fetch(rpcUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getBalance",
                    params: [agent.agentAddress, "latest"],
                    id: 1,
                }),
            })
            const ethBalData = await ethBalResponse.json()
            const ethBalWei = BigInt(ethBalData.result || "0")
            setEthBalance(formatUnits(ethBalWei, 18))

        } catch (error) {
            console.error("Error loading balances:", error)
        } finally {
            setLoadingBalances(false)
        }
    }

    const handleMaxAmount = () => {
        const balance = token === "USDC" ? usdcBalance : ethBalance
        setAmount(balance)
    }

    const handleSend = async () => {
        if (!recipient || !amount || parseFloat(amount) <= 0) {
            toast.error("Please enter a valid recipient and amount")
            return
        }

        if (!user?.id) {
            toast.error("Please sign in first")
            return
        }

        if (!recipient.startsWith("0x") || recipient.length !== 42) {
            toast.error("Invalid recipient address")
            return
        }

        setIsSending(true)
        try {
            // Get agent private key
            // NOTE: In production (Vercel KV), we need to fetch the private key from the API
            // But for now, getAgentWallet helper handles local/remote logic or relies on previously stored key?
            // Actually, getAgentWallet only supports local key extraction if passed as argument
            // or we need a new way to sign transactions if key is on server.
            // 
            // WAIT: The current architecture assumes the client has the private key (locally stored or fetched).
            // If we moved to strict API storage, we need an endpoint to sign transactions OR fetch the encrypted key and decrypt it.
            // `src/hooks/useAgentWallet.ts` fetches the agent info but NOT the private key.
            // 
            // We need to fetch the private key to sign. 
            // Let's assume for now we can fetch it (e.g. from localStorage if it was cached, or we need an API to get it).
            // 
            // The previous code in `payments.tsx` did:
            // const privateKey = localStorage.getItem(`agent_pk_${user.id}`)
            // 
            // If we disabled localStorage, we might have broken this if the key isn't there.
            // BUT: `create-agent.tsx` writes `agent_pk_...` to localStorage even in the API flow?
            // Let's check `useAgentWallet.ts` createAgent function.
            //
            // In `useAgentWallet.ts`:
            // const data = await response.json() 
            // setAgent(data)
            // return data
            //
            // It does NOT return the private key in the API response (security!).
            //
            // CRITICAL ISSUE: If we store agent in DB, we need a way to sign transactions.
            // Option 1: The client gets the private key ONCE upon creation and stores it locally (localStorage).
            // Option 2: The server signs transactions (meta-transactions).
            // 
            // Existing `createAgent` in `useAgentWallet.ts` (API path):
            // It calls `/api/agent/create`. That API returns `id, adminAddress, agentAddress` but NOT privateKey.
            // 
            // So if I disabled localStorage fallback, I might have broken the ability to sign transactions 
            // UNLESS the user creates the agent *locally* and we sync it, OR the API returns the key once.
            // 
            // Let's check `api/agent/create.ts` again.
            // It returns: id, adminAddress, agentAddress, createdAt. NO privateKey.
            //
            // So currently, if utilizing the API, the client NEVER gets the private key.
            // This means the client CANNOT sign transactions.
            // 
            // How was it working before? 
            // The user was likely using the localStorage path where `createAgentWallet` returns the key.
            // 
            // TO FIX THIS for the "Strict Mode":
            // We must either:
            // 1. Return the private key (encrypted or not) in the create response so the client can store it.
            // 2. OR have a server-side endpoint to sign or execute transactions.
            // 
            // Given the current architecture uses `thirdweb` SDK on the client with a SmartAccount, 
            // we need the "personal wallet" private key (the admin key) on the client to sign user ops.
            // 
            // I will assume for now that we will fetch the private key from an endpoint OR 
            // (better) we should have `create-agent` return the private key in the response (only once).
            // 
            // Let's verify `api/agent/create.ts` logic.
            // It does NOT return it.
            //
            // I should update `api/agent/create.ts` to return the privateKey in the response 
            // so the client can save it to localStorage (strictly for signing).
            // 
            // But wait, if I disabled localStorage access in `useAgentWallet`, that just affects *loading the agent object*.
            // It doesn't prevent us from storing the PK in localStorage for signing purposes.
            // 
            // So:
            // 1. Update `api/agent/create.ts` to return `privateKey`.
            // 2. Update `useAgentWallet.ts` to save `data.privateKey` to localStorage `agent_pk_${id}`.
            // 3. Then `getAgentWallet(privateKey)` will work.
            // 
            // However, for EXISTING agents created via API, the client won't have the key if they cleared storage.
            // We might need an endpoint `api/agent/reveal-key` (password protected?) or similar.
            // 
            // For now, I'll attempt to read from localStorage. If missing, I'll show an error.

            const privateKey = localStorage.getItem(`agent_pk_${user.id}`)
            if (!privateKey) {
                throw new Error("Agent private key not found. Please recreate your agent.") // This is a hard blocker if key is lost
            }

            const { agentWallet } = await getAgentWallet(privateKey)
            const account = agentWallet.getAccount()
            if (!account) throw new Error("Could not get agent account")

            let txHash: string

            if (token === "ETH") {
                toast.error("ETH transfers not yet supported for smart wallets")
                setIsSending(false)
                return
            } else {
                // USDC transfer
                const usdcContract = getContract({
                    client: thirdwebClient,
                    address: TOKEN_ADDRESSES.USDC,
                    chain: arbitrum,
                })

                const amountInUnits = parseUnits(amount, 6)

                const transaction = prepareContractCall({
                    contract: usdcContract,
                    method: "function transfer(address to, uint256 amount) returns (bool)",
                    params: [recipient as `0x${string}`, amountInUnits],
                })

                const result = await sendTransaction({
                    transaction,
                    account,
                })

                txHash = result.transactionHash
            }

            setLastTxHash(txHash)
            toast.success("Payment sent successfully!")

            // Load balances again
            await loadBalances()

            if (onSuccess) onSuccess()

        } catch (error: any) {
            console.error("Send error:", error)
            toast.error(error.message || "Failed to send payment")
        } finally {
            setIsSending(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Payment</DialogTitle>
                    <DialogDescription>
                        Send funds from your agent wallet to any address.
                    </DialogDescription>
                </DialogHeader>

                {lastTxHash ? (
                    <div className="py-6 text-center space-y-4">
                        <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-medium text-lg">Transaction Sent!</h3>
                            <p className="text-sm text-muted-foreground break-all mt-1">{lastTxHash}</p>
                        </div>
                        <div className="flex gap-2 justify-center pt-2">
                            <Button variant="outline" asChild>
                                <a href={`https://arbiscan.io/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer">
                                    View on Explorer
                                </a>
                            </Button>
                            <Button onClick={() => {
                                setLastTxHash("")
                                setAmount("")
                                setRecipient("")
                                onOpenChange(false)
                            }}>
                                Done
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="recipient">Recipient Address</Label>
                            <Input
                                id="recipient"
                                placeholder="0x..."
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <div className="flex justify-between">
                                    <Label htmlFor="amount">Amount</Label>
                                    <span
                                        className="text-xs text-primary cursor-pointer hover:underline"
                                        onClick={handleMaxAmount}
                                    >
                                        Max
                                    </span>
                                </div>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="token">Token</Label>
                                <Select value={token} onValueChange={(v) => setToken(v as TokenSymbol)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select token" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USDC">USDC</SelectItem>
                                        <SelectItem value="ETH">ETH</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Available Balance</span>
                                <span className="font-medium text-foreground">
                                    {token === "USDC" ? `$${usdcBalance}` : `${ethBalance} ETH`}
                                </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Network</span>
                                <span className="font-medium text-foreground">Arbitrum One</span>
                            </div>
                        </div>
                    </div>
                )}

                {!lastTxHash && (
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose} disabled={isSending}>Cancel</Button>
                        <Button onClick={handleSend} disabled={isSending || !recipient || !amount}>
                            {isSending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                            ) : (
                                <><Send className="mr-2 h-4 w-4" /> Send Funds</>
                            )}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
