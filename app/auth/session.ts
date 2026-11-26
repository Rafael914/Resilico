import { createHmac, timingSafeEqual } from 'node:crypto'

export type Session = { user_id: number; role: string; exp: number }

export function verifySession(token?: string): Session | null {
  const secret = process.env.JWT_SECRET
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const content = `${parts[0]}.${parts[1]}`
  const expected = createHmac('sha256', secret).update(content).digest()
  let received: Buffer
  try {
    received = Buffer.from(parts[2], 'base64url')
  } catch {
    return null
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

  try {
    const session = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Session
    if (!Number.isInteger(session.user_id) || session.exp <= Math.floor(Date.now() / 1000)) return null
    return session
  } catch {
    return null
  }
}
