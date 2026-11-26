import { cookies } from 'next/headers'
import { verifySession } from '../auth/session'

export type AdminUser = { user_id: number; first_name: string; last_name: string; email: string; role: string }
export type AppUser = AdminUser

export function adminDatabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  return url && key ? { url, key } : null
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const config = adminDatabaseConfig()
  const jar = await cookies()
  const session = verifySession(jar.get('resilico-session')?.value)
  if (!config || !session) return null

  const query = new URLSearchParams({
    select: 'user_id,first_name,last_name,email,role',
    user_id: `eq.${session.user_id}`,
    limit: '1',
  })
  const response = await fetch(`${config.url}/rest/v1/users?${query}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const users = (await response.json()) as AppUser[]
  return users[0] ?? null
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const user = await getCurrentUser()
  return user?.role === 'admin' ? user : null
}
