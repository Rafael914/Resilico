'use server'

import bcrypt from 'bcryptjs'
import { createHmac } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

type UserRow = {
  user_id: number
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  password_hash: string
  role: string
}

function databaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return { url, key }
}

function signSession(user: Pick<UserRow, 'user_id' | 'role'>) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ user_id: user.user_id, role: user.role, iat: now, exp: now + 3600 })).toString('base64url')
  const content = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(content).digest('base64url')
  return `${content}.${signature}`
}

async function saveSession(user: Pick<UserRow, 'user_id' | 'role'>) {
  const jar = await cookies()
  jar.set('resilico-session', signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })
}

async function findUser(email: string): Promise<UserRow | null> {
  const config = databaseConfig()
  if (!config) return null
  const query = new URLSearchParams({
    select: 'user_id,first_name,last_name,email,phone_number,password_hash,role',
    email: `eq.${email}`,
    limit: '1',
  })
  const response = await fetch(`${config.url}/rest/v1/users?${query}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const rows = (await response.json()) as UserRow[]
  return rows[0] ?? null
}

export async function register(formData: FormData) {
  const config = databaseConfig()
  if (!config || !process.env.JWT_SECRET) redirect('/register?message=configuration')

  const firstName = String(formData.get('first_name') ?? '').trim()
  const lastName = String(formData.get('last_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const addressLine1 = String(formData.get('address_line1') ?? '').trim()
  const addressLine2 = String(formData.get('address_line2') ?? '').trim()
  const country = String(formData.get('country') ?? '').trim()
  const provinceState = String(formData.get('province_state') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  const postalCode = String(formData.get('postal_code') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (!firstName || !lastName || !email || !addressLine1 || !country || !city || !postalCode || password.length < 8) redirect('/register?message=invalid')
  if (password !== confirmPassword) redirect('/register?message=password-mismatch')

  const passwordHash = await bcrypt.hash(password, 10)
  let response: Response
  try {
    response = await fetch(`${config.url}/rest/v1/users?select=user_id,role`, {
      method: 'POST',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber || null,
        password_hash: passwordHash,
        role: 'customer',
      }),
      cache: 'no-store',
    })
  } catch {
    redirect('/register?message=configuration')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const conflict = `${body.constraint ?? ''} ${body.message ?? ''} ${body.details ?? ''}`.toLowerCase()
    if (body.code === '23505' && conflict.includes('email')) redirect('/register?message=email-exists')
    if (body.code === '23505') redirect('/register?message=database-conflict')
    redirect('/register?message=signup-failed')
  }

  const users = await response.json() as Pick<UserRow, 'user_id' | 'role'>[]
  const user = users[0]
  if (!user) redirect('/register?message=signup-failed')

  let addressResponse: Response
  try {
    addressResponse = await fetch(`${config.url}/rest/v1/address`, {
      method: 'POST',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: user.user_id,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        country,
        province_state: provinceState || null,
        city,
        postal_code: postalCode,
      }),
      cache: 'no-store',
    })
  } catch {
    try {
      await fetch(`${config.url}/rest/v1/users?user_id=eq.${user.user_id}`, {
        method: 'DELETE',
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: 'no-store',
      })
    } catch { /* Keep the account result clear even if the cleanup request also fails. */ }
    redirect('/register?message=configuration')
  }

  if (!addressResponse.ok) {
    try {
      await fetch(`${config.url}/rest/v1/users?user_id=eq.${user.user_id}`, {
        method: 'DELETE',
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: 'no-store',
      })
    } catch { /* Keep the original address save result. */ }
    redirect('/register?message=address-save-failed')
  }

  await saveSession(user)
  redirect(user.role === 'admin' ? '/admin' : '/dashboard')
}

export async function login(formData: FormData) {
  if (!databaseConfig() || !process.env.JWT_SECRET) redirect('/login?message=configuration')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) redirect('/login?message=login-failed')

  let user: UserRow | null
  try {
    user = await findUser(email)
  } catch {
    redirect('/login?message=configuration')
  }
  if (!user || !await bcrypt.compare(password, user.password_hash)) redirect('/login?message=login-failed')
  await saveSession(user)
  redirect(user.role === 'admin' ? '/admin' : '/dashboard')
}

export async function signOut() {
  const jar = await cookies()
  jar.delete('resilico-session')
  redirect('/login')
}
