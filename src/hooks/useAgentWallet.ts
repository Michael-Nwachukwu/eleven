import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { createAgentWallet } from '@/services/thirdweb-agent-service'

export interface AgentWallet {
    id: string
    adminAddress: string
    agentAddress: string
    createdAt: string
    isActive: boolean
    ensName?: string
    agentName?: string
    erc8004TokenId?: string
}

// Force API usage (Vercel KV) even in dev mode to ensure consistency
const USE_LOCALSTORAGE = false // import.meta.env.DEV

export function useAgentWallet() {
    const { user } = usePrivy()
    const [agent, setAgent] = useState<AgentWallet | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadAgent() {
            if (!user?.id) {
                setLoading(false)
                return
            }

            try {
                if (USE_LOCALSTORAGE) {
                    // Development mode - use localStorage
                    const stored = localStorage.getItem(`agent_${user.id}`)
                    if (stored) {
                        setAgent(JSON.parse(stored))
                    }
                } else {
                    // Production mode - use API
                    const response = await fetch(`/api/agent/${user.id}`)

                    if (response.ok) {
                        const data = await response.json()
                        setAgent(data)
                    } else if (response.status === 404) {
                        setAgent(null)
                    } else {
                        throw new Error('Failed to load agent')
                    }
                }
            } catch (err: any) {
                console.error('Error loading agent:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        loadAgent()
    }, [user?.id])

    const createAgent = async (agentName?: string) => {
        if (!user?.id) {
            throw new Error('User not authenticated')
        }

        setLoading(true)
        setError(null)

        try {
            if (USE_LOCALSTORAGE) {
                // Development mode - create wallet directly
                console.log('Creating agent wallet locally (dev mode)...')

                const walletData = await createAgentWallet(user.id)

                const agentData: AgentWallet = {
                    id: crypto.randomUUID(),
                    adminAddress: walletData.adminAddress,
                    agentAddress: walletData.agentAddress,
                    createdAt: new Date().toISOString(),
                    isActive: true,
                }

                // Store in localStorage
                localStorage.setItem(`agent_${user.id}`, JSON.stringify(agentData))
                localStorage.setItem(`agent_pk_${user.id}`, walletData.privateKey)

                setAgent(agentData)
                return agentData
            } else {
                // Production mode - use API
                const response = await fetch('/api/agent/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userId: user.id, agentName }),
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to create agent')
                }

                const data = await response.json()

                // Store private key locally for signing transactions
                if (data.privateKey) {
                    localStorage.setItem(`agent_pk_${user.id}`, data.privateKey)
                    // Remove from state object security
                    delete data.privateKey
                }

                setAgent(data)
                return data
            }
        } catch (err: any) {
            console.error('Error creating agent:', err)
            setError(err.message)
            throw err
        } finally {
            setLoading(false)
        }
    }

    return {
        agent,
        loading,
        error,
        hasAgent: !!agent,
        createAgent,
    }
}
