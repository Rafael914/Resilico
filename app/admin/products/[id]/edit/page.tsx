import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { signOut } from '../../../../auth/actions'
import { dbHeaders } from '../../../../api/v1/_lib'
import { adminDatabaseConfig, getCurrentAdmin } from '../../../security'
import { updateProduct, updateProductVariant } from '../../../actions'
import PendingButton from '../../../PendingButton'
import '../../../admin.css'

type Product = {
  product_id: number
  name: string
  description: string | null
  base_price: number | string
  cost_price: number | string | null
  brand: string | null
  is_active: boolean | null
  image: string | null
}

type ProductVariant = {
  variant_id: number
  sku: string
  size: string
  color: string
  stock_quantity: number | null
}

function statusMessage(status?: string) {
  switch (status) {
    case 'saved': return 'Product details saved.'
    case 'variant-saved': return 'Variant details and stock saved.'
    case 'invalid': return 'Enter a product name and valid prices.'
    case 'invalid-variant': return 'Enter a SKU, size, color, and valid stock quantity.'
    case 'save-failed': return 'Product details could not be saved.'
    case 'variant-failed': return 'Variant details could not be saved. Check the product_variant table permissions.'
    case 'variant-not-found': return 'That variant was not found for this product.'
    case 'image-too-large': return 'Choose an image smaller than 5 MB.'
    case 'invalid-image': return 'Choose a valid JPEG, PNG, WebP, or GIF image.'
    default: return null
  }
}

export default async function EditProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login?message=admin-only')
  const config = adminDatabaseConfig()
  if (!config) redirect('/admin?status=configuration')

  const { id } = await params
  const productId = Number(id)
  if (!Number.isInteger(productId) || productId < 1) notFound()

  const productQuery = new URLSearchParams({
    select: 'product_id,name,description,base_price,cost_price,brand,is_active,image',
    product_id: `eq.${productId}`,
    limit: '1',
  })
  const productResponse = await fetch(`${config.url}/rest/v1/products?${productQuery}`, {
    headers: dbHeaders(config),
    cache: 'no-store',
  })
  if (!productResponse.ok) notFound()
  const products = await productResponse.json() as Product[]
  const product = products[0]
  if (!product) notFound()

  const variantsQuery = new URLSearchParams({
    select: 'variant_id,sku,size,color,stock_quantity',
    product_id: `eq.${productId}`,
    order: 'variant_id.asc',
  })
  const variantsResponse = await fetch(`${config.url}/rest/v1/product_variant?${variantsQuery}`, {
    headers: dbHeaders(config),
    cache: 'no-store',
  })
  const variants = variantsResponse.ok ? await variantsResponse.json() as ProductVariant[] : []
  const { status } = await searchParams
  const message = statusMessage(status)

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin"><span className="brand-mark">R</span><span>resilico</span></Link>
        <p className="sidebar-label">WORKSPACE</p>
        <Link className="sidebar-link active" href="/admin"><span aria-hidden="true">▦</span> Products</Link>
        <Link className="sidebar-link" href="/admin/users"><span aria-hidden="true">♙</span> Users</Link>
        <div className="sidebar-bottom"><span className="admin-avatar">{admin.first_name.slice(0, 1).toUpperCase()}</span><div><strong>{admin.first_name} {admin.last_name}</strong><small>Administrator</small></div></div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><span>Resilico <span className="breadcrumb-divider">/</span> Products <span className="breadcrumb-divider">/</span> Edit</span><form action={signOut}><PendingButton className="signout-button" pendingText="Signing out…">Sign out</PendingButton></form></header>
        <div className="admin-content">
          <div className="admin-heading"><div><p className="admin-kicker">CATALOG MANAGEMENT</p><h1>Edit product</h1><p>Update product details and variant inventory.</p></div><Link className="sidebar-link" href="/admin">← Back to products</Link></div>
          {message && <p className={`admin-alert ${status === 'saved' || status === 'variant-saved' ? 'success' : ''}`} role="status">{message}</p>}
          {!variantsResponse.ok && <p className="admin-alert">Product variants could not be loaded. Check the product_variant table permissions.</p>}

          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Product details</h2><p>Product #{product.product_id}</p></div></div>
            <form action={updateProduct} className="product-form">
              <input type="hidden" name="product_id" value={product.product_id} />
              <div className="product-form-grid">
                <div className="admin-field field-wide"><label htmlFor="edit-product-name">Product name</label><input id="edit-product-name" name="name" defaultValue={product.name} maxLength={255} required /></div>
                <div className="admin-field"><label htmlFor="edit-brand">Brand</label><input id="edit-brand" name="brand" defaultValue={product.brand ?? ''} maxLength={100} /></div>
                <div className="admin-field"><label htmlFor="edit-base-price">Selling price (PHP)</label><input id="edit-base-price" name="base_price" type="number" min="0" step="0.01" defaultValue={Number(product.base_price)} required /></div>
                <div className="admin-field"><label htmlFor="edit-cost-price">Cost price (PHP)</label><input id="edit-cost-price" name="cost_price" type="number" min="0" step="0.01" defaultValue={product.cost_price === null ? '' : Number(product.cost_price)} /></div>
                <div className="admin-field field-wide"><label htmlFor="edit-description">Description</label><textarea id="edit-description" name="description" rows={3} defaultValue={product.description ?? ''} /></div>
                <div className="admin-field"><label htmlFor="edit-image">Replace image <span className="field-optional">(optional)</span></label><input id="edit-image" name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /><small className="field-hint">Leave blank to keep the current image.</small></div>
                {product.image && <div className="admin-field"><label>Current image</label><img src={product.image} alt={product.name} className="product-thumb" style={{ width: 72, height: 72 }} /></div>}
              </div>
              <div className="product-form-footer"><label className="active-check"><input type="checkbox" name="is_active" defaultChecked={product.is_active ?? false} /> <span>Active product</span></label><PendingButton className="add-product-button" pendingText="Saving product…">Save product</PendingButton></div>
            </form>
          </section>

          <section className="admin-panel records-panel">
            <div className="panel-heading records-heading"><div><h2>Variants and stock</h2><p>Edit SKU, size, color, and available quantity for each variant.</p></div><span className="records-count">{variants.length} VARIANTS</span></div>
            {!variantsResponse.ok ? <div className="empty-products"><strong>Variants could not be loaded.</strong></div> : variants.length === 0 ? <div className="empty-products"><strong>No variants for this product</strong><p>Add a variant through Supabase or the product creation form.</p></div> : <div className="product-form">{variants.map((variant) => <form action={updateProductVariant} className="product-form-grid variant-edit-form" key={variant.variant_id}>
              <input type="hidden" name="product_id" value={product.product_id} /><input type="hidden" name="variant_id" value={variant.variant_id} />
              <div className="admin-field"><label htmlFor={`sku-${variant.variant_id}`}>SKU</label><input id={`sku-${variant.variant_id}`} name="sku" defaultValue={variant.sku} required maxLength={100} /></div>
              <div className="admin-field"><label htmlFor={`size-${variant.variant_id}`}>Size</label><input id={`size-${variant.variant_id}`} name="size" defaultValue={variant.size} required maxLength={50} /></div>
              <div className="admin-field"><label htmlFor={`color-${variant.variant_id}`}>Color</label><input id={`color-${variant.variant_id}`} name="color" defaultValue={variant.color} required maxLength={50} /></div>
              <div className="admin-field"><label htmlFor={`stock-${variant.variant_id}`}>Stock quantity</label><input id={`stock-${variant.variant_id}`} name="stock_quantity" type="number" min="0" step="1" defaultValue={variant.stock_quantity ?? 0} required /></div>
              <div className="product-form-footer field-wide"><span className="field-hint">Variant #{variant.variant_id}</span><PendingButton className="add-product-button" pendingText="Saving variant…">Save variant</PendingButton></div>
            </form>)}</div>}
          </section>
        </div>
      </section>
    </main>
  )
}
