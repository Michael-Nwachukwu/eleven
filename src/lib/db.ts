import { createClient } from 'redis'
import crypto from 'crypto'

// Types
export interface AgentWallet {
    id: string
    userId: string
    adminAddress: string
    agentAddress: string
    encryptedPrivateKey: string
    createdAt: string
    updatedAt: string
    isActive: boolean
}

export interface Payment {
    id: string
    agentWalletId: string
    transactionHash?: string
    paymentType: 'crypto' | 'fiat'
    amount: string
    token: string
    status: 'pending' | 'completed' | 'failed'
    metadata?: Record<string, any>
    createdAt: string
}

export interface PaymentOrder {
    id: string
    userId: string
    createdAt: string
    amount: string
    token: string
    currency: string
    mode: 'crypto' | 'fiat'
    description: string
    status: 'active' | 'completed' | 'cancelled'
    payTo: string
    x402Uri: string
    totalCollected: string
    fulfillmentCount: number
    metadata?: Record<string, any>
}

export interface PaymentFulfillment {
    id: string
    orderId: string
    payerName: string
    payerEmail: string
    amount: string
    fee: string
    transactionHash: string
    paidAt: string
    paymentMethod: 'external' | 'agent' | 'aeon'
}

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL
        })

        redisClient.on('error', (err) => console.error('Redis Client Error', err))

        await redisClient.connect()
    }

    return redisClient
}

// Encryption utilities
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production'

export function encryptPrivateKey(privateKey: string): string {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(privateKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return JSON.stringify({
        encrypted,
        iv: iv.toString('hex')
    })
}

export function decryptPrivateKey(encryptedData: string): string {
    const { encrypted, iv } = JSON.parse(encryptedData)
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)

    const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(iv, 'hex')
    )

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}

// Agent Wallet Database Operations
export async function createAgentWallet(
    userId: string,
    adminAddress: string,
    agentAddress: string,
    privateKey: string
): Promise<AgentWallet> {
    const redis = await getRedisClient()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const agentWallet: AgentWallet = {
        id,
        userId,
        adminAddress,
        agentAddress,
        encryptedPrivateKey: encryptPrivateKey(privateKey),
        createdAt: now,
        updatedAt: now,
        isActive: true
    }

    // Store in Redis with multiple keys for different access patterns
    await redis.set(`agent:${id}`, JSON.stringify(agentWallet))
    await redis.set(`agent:user:${userId}`, id) // Index by userId
    await redis.set(`agent:address:${agentAddress}`, id) // Index by address

    return agentWallet
}

export async function getAgentByUserId(userId: string): Promise<AgentWallet | null> {
    const redis = await getRedisClient()
    const agentId = await redis.get(`agent:user:${userId}`)
    if (!agentId) return null

    const agentData = await redis.get(`agent:${agentId}`)
    if (!agentData) return null

    return JSON.parse(agentData)
}

export async function getAgentById(id: string): Promise<AgentWallet | null> {
    const redis = await getRedisClient()
    const agentData = await redis.get(`agent:${id}`)
    if (!agentData) return null

    return JSON.parse(agentData)
}

export async function getAgentByAddress(address: string): Promise<AgentWallet | null> {
    const redis = await getRedisClient()
    const agentId = await redis.get(`agent:address:${address}`)
    if (!agentId) return null

    const agentData = await redis.get(`agent:${agentId}`)
    if (!agentData) return null

    return JSON.parse(agentData)
}

export async function getDecryptedPrivateKey(userId: string): Promise<string | null> {
    const agent = await getAgentByUserId(userId)
    if (!agent) return null

    return decryptPrivateKey(agent.encryptedPrivateKey)
}

// Payment History Operations (Legacy / Agent-centric)
export async function createPayment(
    agentWalletId: string,
    paymentType: 'crypto' | 'fiat',
    amount: string,
    token: string,
    metadata?: Record<string, any>
): Promise<Payment> {
    const redis = await getRedisClient()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const payment: Payment = {
        id,
        agentWalletId,
        paymentType,
        amount,
        token,
        status: 'pending',
        metadata,
        createdAt: now
    }

    // Store payment
    await redis.set(`payment:${id}`, JSON.stringify(payment))

    // Add to agent's payment list
    await redis.lPush(`payments:agent:${agentWalletId}`, id)

    return payment
}

export async function updatePaymentStatus(
    paymentId: string,
    status: 'completed' | 'failed',
    transactionHash?: string
): Promise<Payment | null> {
    const redis = await getRedisClient()
    const paymentData = await redis.get(`payment:${paymentId}`)
    if (!paymentData) return null

    const payment: Payment = JSON.parse(paymentData)
    payment.status = status
    if (transactionHash) {
        payment.transactionHash = transactionHash
    }

    await redis.set(`payment:${paymentId}`, JSON.stringify(payment))
    return payment
}

export async function getPaymentsByAgent(agentWalletId: string, limit = 50): Promise<Payment[]> {
    const redis = await getRedisClient()
    const paymentIds = await redis.lRange(`payments:agent:${agentWalletId}`, 0, limit - 1)
    if (!paymentIds || paymentIds.length === 0) return []

    const payments = await Promise.all(
        paymentIds.map(async (id) => {
            const data = await redis.get(`payment:${id}`)
            return data ? JSON.parse(data) : null
        })
    )

    return payments.filter((p): p is Payment => p !== null)
}

export async function getPaymentById(paymentId: string): Promise<Payment | null> {
    const redis = await getRedisClient()
    const paymentData = await redis.get(`payment:${paymentId}`)
    if (!paymentData) return null

    return JSON.parse(paymentData)
}

// Payment Orders Operations (User-centric)
export async function createPaymentOrder(
    userId: string,
    order: Omit<PaymentOrder, 'id' | 'createdAt' | 'totalCollected' | 'fulfillmentCount'>
): Promise<PaymentOrder> {
    const redis = await getRedisClient()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const newOrder: PaymentOrder = {
        ...order,
        id,
        userId,
        createdAt: now,
        totalCollected: '0',
        fulfillmentCount: 0
    }

    await redis.set(`order:${id}`, JSON.stringify(newOrder))
    await redis.lPush(`orders:user:${userId}`, id)

    return newOrder
}

export async function getPaymentOrdersByUser(userId: string, limit = 50): Promise<PaymentOrder[]> {
    const redis = await getRedisClient()
    const orderIds = await redis.lRange(`orders:user:${userId}`, 0, limit - 1)
    if (!orderIds || orderIds.length === 0) return []

    const orders = await Promise.all(
        orderIds.map(async (id) => {
            const data = await redis.get(`order:${id}`)
            return data ? JSON.parse(data) : null
        })
    )

    return orders.filter((o): o is PaymentOrder => o !== null)
}

export async function getPaymentOrderById(id: string): Promise<PaymentOrder | null> {
    const redis = await getRedisClient()
    const data = await redis.get(`order:${id}`)
    return data ? JSON.parse(data) : null
}

export async function updatePaymentOrder(
    id: string,
    fields: Partial<Omit<PaymentOrder, 'id' | 'userId' | 'createdAt'>>
): Promise<PaymentOrder | null> {
    const redis = await getRedisClient()
    const data = await redis.get(`order:${id}`)
    if (!data) return null

    const order: PaymentOrder = JSON.parse(data)
    const updated = { ...order, ...fields }
    await redis.set(`order:${id}`, JSON.stringify(updated))
    return updated
}

export async function deletePaymentOrder(id: string): Promise<boolean> {
    const redis = await getRedisClient()
    const data = await redis.get(`order:${id}`)
    if (!data) return false

    const order: PaymentOrder = JSON.parse(data)

    // Remove from the user's order list
    await redis.lRem(`orders:user:${order.userId}`, 0, id)

    // Delete the order key itself
    await redis.del(`order:${id}`)

    // Also delete associated fulfillments
    await redis.del(`fulfillments:${id}`)

    return true
}

export async function addFulfillment(
    orderId: string,
    fulfillment: Omit<PaymentFulfillment, 'id' | 'orderId' | 'paidAt'>
): Promise<PaymentFulfillment> {
    const redis = await getRedisClient()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const newFulfillment: PaymentFulfillment = {
        ...fulfillment,
        id,
        orderId,
        paidAt: now
    }

    // Store fulfillment
    await redis.set(`fulfillment:${id}`, JSON.stringify(newFulfillment))
    await redis.lPush(`fulfillments:order:${orderId}`, id)

    // Update order totals
    const order = await getPaymentOrderById(orderId)
    if (order) {
        const currentTotal = parseFloat(order.totalCollected)
        const newAmount = parseFloat(fulfillment.amount)
        order.totalCollected = (currentTotal + newAmount).toString()
        order.fulfillmentCount += 1

        // If fully collected (or just updated), preserve storage
        await redis.set(`order:${orderId}`, JSON.stringify(order))
    }

    return newFulfillment
}

export async function getOrderFulfillments(orderId: string): Promise<PaymentFulfillment[]> {
    const redis = await getRedisClient()
    const ids = await redis.lRange(`fulfillments:order:${orderId}`, 0, -1)
    if (!ids || ids.length === 0) return []

    const fulfillments = await Promise.all(
        ids.map(async (id) => {
            const data = await redis.get(`fulfillment:${id}`)
            return data ? JSON.parse(data) : null
        })
    )

    return fulfillments.filter((f): f is PaymentFulfillment => f !== null)
}
