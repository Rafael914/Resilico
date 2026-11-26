import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { apiContext, dbHeaders, jsonError } from '../_lib'

const maxImageBytes = 5 * 1024 * 1024
const imageTypes: Record<string, { extension: string; check: (bytes: Buffer) => boolean }> = {
  'image/jpeg': { extension: 'jpg', check: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', check: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', check: (bytes) => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
  'image/gif': { extension: 'gif', check: (bytes) => ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) },
}

function textField(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  const context = await apiContext()
  if (!context) return jsonError(401, 'Sign in is required.')
  if (context.user.role !== 'admin') return jsonError(403, 'Admin access required.')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError(400, 'Send the product fields as multipart form-data.')
  }

  const name = textField(form, 'name')
  const brand = textField(form, 'brand')
  const description = textField(form, 'description')
  const basePrice = Number(textField(form, 'base_price'))
  const stockQuantity = Number(textField(form, 'stock_quantity') || '0')
  const costInput = textField(form, 'cost_price')
  const costPrice = costInput ? Number(costInput) : null
  const skuInput = textField(form, 'sku')
  const size = textField(form, 'size') || 'One Size'
  const color = textField(form, 'color') || 'Default'
  const activeInput = textField(form, 'is_active').toLowerCase()
  const isActive = activeInput === '' || activeInput === 'true' || activeInput === 'on' || activeInput === '1'

  const errors: string[] = []
  if (!name) errors.push('Product name is required.')
  if (!Number.isFinite(basePrice) || basePrice < 0) errors.push('Selling price must be a non-negative number.')
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) errors.push('Stock quantity must be a non-negative whole number.')
  if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) errors.push('Cost price must be a non-negative number.')
  if (activeInput && !['true', 'false', 'on', 'off', '1', '0'].includes(activeInput)) errors.push('is_active must be true or false.')
  if (errors.length) return jsonError(400, 'Validation failed.', errors)

  const imageValue = form.get('image') ?? form.get('image_file')
  let imageUrl: string | null = null
  let imagePath: string | null = null
  if (imageValue instanceof File && imageValue.size > 0) {
    const type = imageTypes[imageValue.type]
    if (!type) return jsonError(400, 'Image must be JPEG, PNG, WebP, or GIF.')
    if (imageValue.size > maxImageBytes) return jsonError(400, 'Image must be 5 MB or smaller.')
    const bytes = Buffer.from(await imageValue.arrayBuffer())
    if (!type.check(bytes)) return jsonError(400, 'Image contents do not match the selected image type.')

    const filename = `${randomUUID()}.${type.extension}`
    const directory = path.join(process.cwd(), 'public', 'product-images')
    await mkdir(directory, { recursive: true })
    imagePath = path.join(directory, filename)
    await writeFile(imagePath, bytes, { flag: 'wx' })
    const requestOrigin = new URL(request.url).origin
    const origin = (requestOrigin || process.env.CLIENT_URL || process.env.NEXT_PUBLIC_SITE_URL!).replace(/\/+$/, '')
    imageUrl = `${origin}/product-images/${filename}`
  }

  const productResponse = await fetch(`${context.config.url}/rest/v1/products`, {
    method: 'POST',
    headers: dbHeaders(context.config, 'return=representation'),
    body: JSON.stringify({
      name,
      brand: brand || null,
      description: description || null,
      base_price: basePrice,
      cost_price: costPrice,
      is_active: isActive,
      image: imageUrl,
    }),
    cache: 'no-store',
  })

  if (!productResponse.ok) {
    if (imagePath) await unlink(imagePath).catch(() => undefined)
    return jsonError(400, 'Product could not be saved to the database.', [await productResponse.text()])
  }

  const products = await productResponse.json() as { product_id: number }[]
  const product = products[0]
  if (!product?.product_id) {
    if (imagePath) await unlink(imagePath).catch(() => undefined)
    return jsonError(500, 'Product was saved without a returned product ID.')
  }
  const sku = skuInput || `RES-${product.product_id}-${randomUUID().slice(0, 8).toUpperCase()}`
  const variantResponse = await fetch(`${context.config.url}/rest/v1/product_variant`, {
    method: 'POST',
    headers: dbHeaders(context.config, 'return=representation'),
    body: JSON.stringify({ product_id: product.product_id, sku, size, color, stock_quantity: stockQuantity }),
    cache: 'no-store',
  })

  if (!variantResponse.ok) {
    await fetch(`${context.config.url}/rest/v1/products?product_id=eq.${product.product_id}`, {
      method: 'DELETE', headers: dbHeaders(context.config), cache: 'no-store',
    })
    if (imagePath) await unlink(imagePath).catch(() => undefined)
    return jsonError(400, 'Product variant could not be saved to the database.', [await variantResponse.text()])
  }

  const variants = await variantResponse.json()
  return Response.json({ success: true, product: { ...product, product_variant: variants } }, { status: 201 })
}

export async function GET() {
  const context = await apiContext()
  if (!context) return jsonError(401, 'Sign in is required.')
  if (context.user.role !== 'admin') return jsonError(403, 'Admin access required.')

  const query = new URLSearchParams({
    select: 'product_id,name,description,base_price,cost_price,brand,is_active,created_at,image,product_variant(variant_id,sku,size,color,stock_quantity)',
    order: 'created_at.desc',
  })
  const response = await fetch(`${context.config.url}/rest/v1/products?${query}`, {
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })
  if (!response.ok) return jsonError(500, 'Products could not be loaded.', [await response.text()])
  return Response.json(await response.json())
}
