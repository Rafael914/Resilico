'use server'

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { adminDatabaseConfig, getCurrentAdmin } from '../../../app/admin/security'

const maxImageBytes = 5 * 1024 * 1024

async function saveProductImage(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null
  if (value.size > maxImageBytes) redirect('/admin?status=image-too-large')

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const extension = extensions[value.type]
  if (!extension) redirect('/admin?status=invalid-image')

  const bytes = Buffer.from(await value.arrayBuffer())
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  const isGif = ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))
  if (!(isJpeg || isPng || isWebp || isGif)) redirect('/admin?status=invalid-image')

  const filename = `${randomUUID()}.${extension}`
  const directory = path.join(process.cwd(), 'public', 'product-images')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, filename), bytes, { flag: 'wx' })

  const configuredOrigin = (process.env.CLIENT_URL || process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, '')
  const requestOrigin = (await headers()).get('origin')?.replace(/\/+$/, '')
  const origin = requestOrigin || configuredOrigin
  return { filename, url: origin ? `${origin}/product-images/${filename}` : `/product-images/${filename}` }
}

async function removeProductImage(imageUrl?: string | null) {
  if (!imageUrl) return
  try {
    const pathname = imageUrl.startsWith('/') ? imageUrl : new URL(imageUrl).pathname
    const prefix = '/product-images/'
    if (!pathname.startsWith(prefix)) return
    const filename = path.basename(pathname.slice(prefix.length))
    await unlink(path.join(process.cwd(), 'public', 'product-images', filename))
  } catch {
    // The database delete should still succeed when an old or missing image file cannot be removed.
  }
}

export async function createProduct(formData: FormData) {
  const admin = await getCurrentAdmin()
  const config = adminDatabaseConfig()
  if (!admin) redirect('/login?message=admin-only')
  if (!config) redirect('/admin?status=configuration')

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const brand = String(formData.get('brand') ?? '').trim()
  const imageFile = formData.get('image_file')
  const basePrice = Number(formData.get('base_price'))
  const stockQuantity = Number(formData.get('stock_quantity') ?? 0)
  const costInput = String(formData.get('cost_price') ?? '').trim()
  const costPrice = costInput ? Number(costInput) : null
  const isActive = formData.get('is_active') === 'on'
  const skuInput = String(formData.get('sku') ?? '').trim()
  const size = String(formData.get('size') ?? '').trim() || 'One Size'
  const color = String(formData.get('color') ?? '').trim() || 'Default'

  if (!name || !Number.isFinite(basePrice) || basePrice < 0 || !Number.isInteger(stockQuantity) || stockQuantity < 0 || (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0))) {
    redirect('/admin?status=invalid-product')
  }
  const savedImage = await saveProductImage(imageFile)

  const response = await fetch(`${config.url}/rest/v1/products`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name,
      description: description || null,
      base_price: basePrice,
      cost_price: costPrice,
      brand: brand || null,
      is_active: isActive,
      image: savedImage?.url ?? null,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    if (savedImage) await removeProductImage(savedImage.url)
    redirect('/admin?status=save-failed')
  }

  const products = await response.json() as { product_id: number }[]
  const productId = products[0]?.product_id
  if (!productId) {
    if (savedImage) await removeProductImage(savedImage.url)
    redirect('/admin?status=save-failed')
  }
  const sku = skuInput || `RES-${productId}-${randomUUID().slice(0, 8).toUpperCase()}`
  const variantResponse = await fetch(`${config.url}/rest/v1/product_variant`, {
    method: 'POST',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ product_id: productId, sku, size, color, stock_quantity: stockQuantity }),
    cache: 'no-store',
  })
  if (!variantResponse.ok) {
    await fetch(`${config.url}/rest/v1/products?product_id=eq.${productId}`, {
      method: 'DELETE', headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }, cache: 'no-store',
    })
    if (savedImage) await removeProductImage(savedImage.url)
    redirect('/admin?status=save-failed')
  }
  revalidatePath('/admin')
  redirect('/admin?status=created')
}

export async function updateProduct(formData: FormData) {
  const admin = await getCurrentAdmin()
  const config = adminDatabaseConfig()
  if (!admin) redirect('/login?message=admin-only')
  if (!config) redirect('/admin?status=configuration')

  const productId = Number(formData.get('product_id'))
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const brand = String(formData.get('brand') ?? '').trim()
  const basePrice = Number(formData.get('base_price'))
  const costInput = String(formData.get('cost_price') ?? '').trim()
  const costPrice = costInput ? Number(costInput) : null
  const isActive = formData.get('is_active') === 'on'
  if (!Number.isInteger(productId) || productId < 1 || !name || !Number.isFinite(basePrice) || basePrice < 0 || (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0))) {
    redirect(`/admin/products/${productId}/edit?status=invalid`)
  }

  const imageFile = formData.get('image_file')
  const savedImage = await saveProductImage(imageFile)
  const existingQuery = new URLSearchParams({ select: 'image', product_id: `eq.${productId}`, limit: '1' })
  const existingResponse = await fetch(`${config.url}/rest/v1/products?${existingQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!existingResponse.ok) {
    if (savedImage) await removeProductImage(savedImage.url)
    redirect(`/admin/products/${productId}/edit?status=save-failed`)
  }
  const existingProducts = await existingResponse.json() as { image: string | null }[]
  if (!existingProducts[0]) {
    if (savedImage) await removeProductImage(savedImage.url)
    redirect('/admin?status=not-found')
  }

  const response = await fetch(`${config.url}/rest/v1/products?product_id=eq.${productId}`, {
    method: 'PATCH',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      name,
      description: description || null,
      brand: brand || null,
      base_price: basePrice,
      cost_price: costPrice,
      is_active: isActive,
      ...(savedImage ? { image: savedImage.url } : {}),
    }),
    cache: 'no-store',
  })
  if (!response.ok) {
    if (savedImage) await removeProductImage(savedImage.url)
    redirect(`/admin/products/${productId}/edit?status=save-failed`)
  }
  if (savedImage) await removeProductImage(existingProducts[0].image)
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/')
  redirect(`/admin/products/${productId}/edit?status=saved`)
}

export async function updateProductVariant(formData: FormData) {
  const admin = await getCurrentAdmin()
  const config = adminDatabaseConfig()
  if (!admin) redirect('/login?message=admin-only')
  if (!config) redirect('/admin?status=configuration')

  const productId = Number(formData.get('product_id'))
  const variantId = Number(formData.get('variant_id'))
  const sku = String(formData.get('sku') ?? '').trim()
  const size = String(formData.get('size') ?? '').trim()
  const color = String(formData.get('color') ?? '').trim()
  const stockQuantity = Number(formData.get('stock_quantity'))
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(variantId) || variantId < 1 || !sku || !size || !color || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
    redirect(`/admin/products/${productId}/edit?status=invalid-variant`)
  }

  const query = new URLSearchParams({ variant_id: `eq.${variantId}`, product_id: `eq.${productId}` })
  const response = await fetch(`${config.url}/rest/v1/product_variant?${query}`, {
    method: 'PATCH',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ sku, size, color, stock_quantity: stockQuantity }),
    cache: 'no-store',
  })
  if (!response.ok) redirect(`/admin/products/${productId}/edit?status=variant-failed`)
  const rows = await response.json() as unknown[]
  if (!rows.length) redirect(`/admin/products/${productId}/edit?status=variant-not-found`)

  revalidatePath('/admin')
  revalidatePath('/admin/products')
  redirect(`/admin/products/${productId}/edit?status=variant-saved`)
}

export async function deleteProduct(formData: FormData) {
  const admin = await getCurrentAdmin()
  const config = adminDatabaseConfig()
  if (!admin) redirect('/login?message=admin-only')
  if (!config) redirect('/admin?status=configuration')

  const productId = Number(formData.get('product_id'))
  if (!Number.isInteger(productId) || productId < 1) redirect('/admin?status=delete-failed')

  const productQuery = new URLSearchParams({ select: 'image', product_id: `eq.${productId}`, limit: '1' })
  const productResponse = await fetch(`${config.url}/rest/v1/products?${productQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  const rows = productResponse.ok ? await productResponse.json() as { image: string | null }[] : []

  const orderItems = await fetch(`${config.url}/rest/v1/order_items?product_id=eq.${productId}&select=order_item_id&limit=1`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (orderItems.ok && (await orderItems.json() as unknown[]).length > 0) redirect('/admin?status=delete-failed')

  const variantsResponse = await fetch(`${config.url}/rest/v1/product_variant?product_id=eq.${productId}`, {
    method: 'DELETE',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!variantsResponse.ok) redirect('/admin?status=delete-failed')

  const response = await fetch(`${config.url}/rest/v1/products?product_id=eq.${productId}`, {
    method: 'DELETE',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  if (!response.ok) redirect('/admin?status=delete-failed')
  await removeProductImage(rows[0]?.image)
  revalidatePath('/admin')
  redirect('/admin?status=deleted')
}

export async function updateProductStock(formData: FormData) {
  const admin = await getCurrentAdmin()
  const config = adminDatabaseConfig()
  if (!admin) redirect('/login?message=admin-only')
  if (!config) redirect('/admin?status=configuration')
  const variantId = Number(formData.get('variant_id'))
  const stockQuantity = Number(formData.get('stock_quantity'))
  if (!Number.isInteger(variantId) || variantId < 1 || !Number.isInteger(stockQuantity) || stockQuantity < 0) redirect('/admin?status=invalid-stock')
  const response = await fetch(`${config.url}/rest/v1/product_variant?variant_id=eq.${variantId}`, {
    method: 'PATCH', headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ stock_quantity: stockQuantity }), cache: 'no-store',
  })
  if (!response.ok) redirect('/admin?status=stock-failed')
  revalidatePath('/admin')
  redirect('/admin?status=stock-updated')
}
