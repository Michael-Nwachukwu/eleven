import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()

    const userId = (req.query.userId as string) || (req.body?.userId as string)

    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId is required' })
    }

    const { getAgentByUserId, updateAgentNotificationEmail } = await import('../../src/lib/db')

    if (req.method === 'GET') {
        const agent = await getAgentByUserId(userId)
        if (!agent) return res.status(404).json({ error: 'Agent not found' })
        return res.status(200).json({ notificationEmail: agent.notificationEmail || '' })

    } else if (req.method === 'PUT') {
        const { email } = req.body || {}
        if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email is required' })

        const updated = await updateAgentNotificationEmail(userId, email.trim().toLowerCase())
        if (!updated) return res.status(404).json({ error: 'Agent not found' })
        return res.status(200).json({ success: true, notificationEmail: email.trim().toLowerCase() })

    } else {
        return res.status(405).json({ error: 'Method not allowed' })
    }
}
