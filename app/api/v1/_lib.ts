import { cookies } from 'next/headers'
import { verifySession } from '../../auth/session'
import { adminDatabaseConfig, getCurrentUser } from '../../admin/security'

export async function apiContext() {
  const config = adminDatabaseConfig()
  const jar = await cookies()
  const session = verifySession(jar.get('resilico-session')?.value)
  const user = session ? await getCurrentUser() : null
  if (!config || !user) return null
  return { config, user }
}

export function jsonError(status: number, message: string, errors: string[] = []) {
  return Response.json({ success: false, statusCode: status, message, errors, timestamp: new Date().toISOString() }, { status })
}

export function dbHeaders(config: { key: string }, prefer?: string) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  }
}
