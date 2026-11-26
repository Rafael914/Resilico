'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { adminDatabaseConfig, getCurrentAdmin } from '../../../app/admin/security'

export async function createAdminManagedUser(formData: FormData) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login?message=admin-only')
  const config = adminDatabaseConfig()
  if (!config) redirect('/admin/users?status=configuration')

  const firstName = String(formData.get('first_name') ?? '').trim()
  const lastName = String(formData.get('last_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!firstName || !lastName || !email || password.length < 8) redirect('/admin/users?status=invalid')

  const passwordHash = await bcrypt.hash(password, 10)
  const response = await fetch(`${config.url}/rest/v1/users`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
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

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string }
    if (error.code === '23505') redirect('/admin/users?status=email-exists')
    redirect('/admin/users?status=save-failed')
  }

  revalidatePath('/admin/users')
  redirect('/admin/users?status=created')
}

export async function deleteAdminManagedUser(formData: FormData) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login?message=admin-only')
  const config = adminDatabaseConfig()
  if (!config) redirect('/admin/users?status=configuration')

  const userId = Number(formData.get('user_id'))
  if (!Number.isInteger(userId) || userId < 1) redirect('/admin/users?status=delete-failed')
  if (userId === admin.user_id) redirect('/admin/users?status=cannot-delete-self')

  const targetQuery = new URLSearchParams({ select: 'user_id,role', user_id: `eq.${userId}`, limit: '1' })
  const targetResponse = await fetch(`${config.url}/rest/v1/users?${targetQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!targetResponse.ok) redirect('/admin/users?status=delete-failed')
  const targets = await targetResponse.json() as { user_id: number; role: string }[]
  const target = targets[0]
  if (!target) redirect('/admin/users?status=user-not-found')
  if (target.role === 'admin') redirect('/admin/users?status=admin-protected')

  const orderQuery = new URLSearchParams({ select: 'order_id', user_id: `eq.${userId}`, limit: '1' })
  const orderResponse = await fetch(`${config.url}/rest/v1/orders?${orderQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (orderResponse.ok && (await orderResponse.json() as unknown[]).length > 0) {
    redirect('/admin/users?status=user-has-orders')
  }

  const addressResponse = await fetch(`${config.url}/rest/v1/address?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!addressResponse.ok) redirect('/admin/users?status=delete-failed')

  const deleteResponse = await fetch(`${config.url}/rest/v1/users?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!deleteResponse.ok) {
    const error = await deleteResponse.json().catch(() => ({})) as { code?: string }
    if (error.code === '23503') redirect('/admin/users?status=user-has-records')
    redirect('/admin/users?status=delete-failed')
  }

  revalidatePath('/admin/users')
  redirect('/admin/users?status=deleted')
}
