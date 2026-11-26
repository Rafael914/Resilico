import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { apiContext, dbHeaders, jsonError } from '../../_lib'

type RouteContext = { params: Promise<{ id: string }> }

async function getProductId(params: RouteContext['params']) {
  const { id } = await params
  const productId = Number(id)
  return Number.isInteger(productId) && productId > 0 ? productId : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await apiContext()
  if (!context) return jsonError(401, 'Sign in is required.')
  if (context.user.role !== 'admin') return jsonError(403, 'Admin access required.')

  const productId = await getProductId(params)
  if (!productId) return jsonError(400, 'Product ID must be a positive whole number.')

  const query = new URLSearchParams({
    select: 'product_id,name,description,base_price,cost_price,brand,is_active,created_at,image,product_variant(variant_id,sku,size,color,stock_quantity)',
    product_id: `eq.${productId}`,
    limit: '1',
  })
  const response = await fetch(`${context.config.url}/rest/v1/products?${query}`, {
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })
  if (!response.ok) return jsonError(500, 'Product could not be loaded.', [await response.text()])
  const products = await response.json() as unknown[]
  if (!products.length) return jsonError(404, 'Product not found.')
  return Response.json(products[0])
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await apiContext()
  if (!context) return jsonError(401, 'Sign in is required.')
  if (context.user.role !== 'admin') return jsonError(403, 'Admin access required.')

  const productId = await getProductId(params)
  if (!productId) return jsonError(400, 'Product ID must be a positive whole number.')

  const query = new URLSearchParams({ select: 'product_id,image', product_id: `eq.${productId}`, limit: '1' })
  const productResponse = await fetch(`${context.config.url}/rest/v1/products?${query}`, {
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })
  if (!productResponse.ok) return jsonError(500, 'Product could not be loaded before deletion.')
  const products = await productResponse.json() as { product_id: number; image: string | null }[]
  const product = products[0]
  if (!product) return jsonError(404, 'Product not found.')

  const orderQuery = new URLSearchParams({ select: 'order_item_id', product_id: `eq.${productId}`, limit: '1' })
  const orderResponse = await fetch(`${context.config.url}/rest/v1/order_items?${orderQuery}`, {
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })
  if (orderResponse.ok && (await orderResponse.json() as unknown[]).length) {
    return jsonError(409, 'Product cannot be deleted because it is included in an order.')
  }

  const variantResponse = await fetch(`${context.config.url}/rest/v1/product_variant?product_id=eq.${productId}`, {
    method: 'DELETE',
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })
  if (!variantResponse.ok) return jsonError(500, 'Product variants could not be deleted.')

  const deleteResponse = await fetch(`${context.config.url}/rest/v1/products?product_id=eq.${productId}`, {
    method: 'DELETE',
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })
  if (!deleteResponse.ok) return jsonError(500, 'Product could not be deleted.', [await deleteResponse.text()])

  if (product.image) {
    try {
      const pathname = product.image.startsWith('/') ? product.image : new URL(product.image).pathname
      const prefix = '/product-images/'
      if (pathname.startsWith(prefix)) {
        const filename = path.basename(pathname.slice(prefix.length))
        if (filename && filename !== '.' && filename !== path.sep) {
          await unlink(path.join(process.cwd(), 'public', 'product-images', filename)).catch(() => undefined)
        }
      }
    } catch {
      // The database deletion should still succeed if an old image is missing.
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/')
  return Response.json({ success: true, productId, message: 'Product deleted.' })
}
