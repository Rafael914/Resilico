import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signOut } from '../auth/actions'
import { createProduct, deleteProduct, updateProductStock } from './actions'
import { adminDatabaseConfig, getCurrentAdmin } from './security'
import PendingButton from './PendingButton'
import './admin.css'

type Product = {
  product_id: number
  name: string
  description: string | null
  base_price: number | string
  cost_price: number | string | null
  brand: string | null
  is_active: boolean | null
  created_at: string | null
  image: string | null
  product_variant: { variant_id: number; sku: string; size: string; color: string; stock_quantity: number | null }[]
}

function statusMessage(status?: string) {
  switch (status) {
    case 'created': return 'Product added successfully.'
    case 'deleted': return 'Product deleted.'
    case 'stock-updated': return 'Inventory updated.'
    case 'invalid-stock': return 'Enter a valid whole number for stock.'
    case 'stock-failed': return 'Inventory could not be updated. Apply the ordering migration first.'
    case 'invalid-product': return 'Enter a product name and valid prices.'
    case 'invalid-image': return 'Choose a valid JPEG, PNG, WebP, or GIF image.'
    case 'image-too-large': return 'Choose an image smaller than 5 MB.'
    case 'save-failed': return 'Product could not be saved. Check the products table schema and required fields.'
    case 'delete-failed': return 'Product could not be deleted. Check whether related order items prevent deletion.'
    case 'configuration': return 'Database configuration is missing on the server.'
    default: return null
  }
}

function money(value: number | string | null) {
  if (value === null) return '—'
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
    : '—'
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login?message=admin-only')
  const config = adminDatabaseConfig()
  if (!config) redirect('/admin?status=configuration')

  const query = new URLSearchParams({
    select: 'product_id,name,description,base_price,cost_price,brand,is_active,created_at,image',
    order: 'created_at.desc',
  })
  const response = await fetch(`${config.url}/rest/v1/products?${query}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  const productRows = response.ok ? (await response.json()) as Omit<Product, 'product_variant'>[] : []
  const variantQuery = new URLSearchParams({
    select: 'variant_id,product_id,sku,size,color,stock_quantity',
    product_id: `in.(${productRows.map((product) => product.product_id).join(',')})`,
    order: 'variant_id.asc',
  })
  const variantResponse = productRows.length ? await fetch(`${config.url}/rest/v1/product_variant?${variantQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  }) : null
  const variantRows = variantResponse?.ok ? await variantResponse.json() as (Product['product_variant'][number] & { product_id: number })[] : []
  const variantsByProduct = new Map<number, Product['product_variant']>()
  for (const variant of variantRows) {
    const productVariants = variantsByProduct.get(variant.product_id) ?? []
    productVariants.push(variant)
    variantsByProduct.set(variant.product_id, productVariants)
  }
  const products = productRows.map((product) => ({ ...product, product_variant: variantsByProduct.get(product.product_id) ?? [] })) as Product[]
  const { status } = await searchParams
  const message = statusMessage(status)
  const activeCount = products.filter((product) => product.is_active).length

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
        <header className="admin-topbar"><span>Resilico <span className="breadcrumb-divider">/</span> Products <Link href="/admin/orders" className="admin-orders-link">Orders &amp; J&amp;T</Link></span><form action={signOut}><PendingButton className="signout-button" pendingText="Signing out…">Sign out</PendingButton></form></header>

        <div className="admin-content">
          <div className="admin-heading"><div><p className="admin-kicker">CATALOG MANAGEMENT</p><h1>Products</h1><p>Manage the products in your Resilico catalog.</p></div><span className="admin-role-pill">ADMIN</span></div>

          {message && <p className={`admin-alert ${status === 'created' || status === 'deleted' ? 'success' : ''}`} role="status">{message}</p>}
          {(!response.ok || (variantResponse && !variantResponse.ok)) && <p className="admin-alert">Product or inventory records could not be loaded. Check the products and product_variant table permissions.</p>}

          <div className="product-stats">
            <article><span>All products</span><strong>{products.length}</strong><small>Records in your catalog</small></article>
            <article><span>Active products</span><strong>{activeCount}</strong><small>Visible and available</small></article>
          </div>

          <section className="admin-panel add-product-panel">
            <div className="panel-heading"><div><h2>Add a product</h2><p>Enter the product details below.</p></div><span className="add-icon" aria-hidden="true">＋</span></div>
            <form action={createProduct} className="product-form">
              <div className="product-form-grid">
                <div className="admin-field field-wide"><label htmlFor="product-name">Product name</label><input id="product-name" name="name" placeholder="e.g. Everyday Canvas Tote" maxLength={255} required /></div>
                <div className="admin-field"><label htmlFor="brand">Brand</label><input id="brand" name="brand" placeholder="Brand name" maxLength={100} /></div>
                <div className="admin-field"><label htmlFor="image-file">Product image <span className="field-optional">(optional)</span></label><input id="image-file" name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /><small className="field-hint">JPEG, PNG, WebP, or GIF · up to 5 MB</small></div>
                <div className="admin-field"><label htmlFor="base-price">Selling price (PHP)</label><input id="base-price" name="base_price" type="number" min="0" step="0.01" placeholder="0.00" required /></div>
                <div className="admin-field"><label htmlFor="stock-quantity">Stock quantity</label><input id="stock-quantity" name="stock_quantity" type="number" min="0" step="1" defaultValue="0" required /></div>
                <div className="admin-field"><label htmlFor="cost-price">Cost price (PHP)</label><input id="cost-price" name="cost_price" type="number" min="0" step="0.01" placeholder="Optional" /></div>
                <div className="admin-field"><label htmlFor="variant-sku">Variant SKU <span className="field-optional">(optional)</span></label><input id="variant-sku" name="sku" placeholder="Generated if blank" maxLength={100} /></div>
                <div className="admin-field"><label htmlFor="variant-size">Size</label><input id="variant-size" name="size" placeholder="One Size" maxLength={50} /></div>
                <div className="admin-field"><label htmlFor="variant-color">Color</label><input id="variant-color" name="color" placeholder="Default" maxLength={50} /></div>
                <div className="admin-field field-wide"><label htmlFor="description">Description</label><textarea id="description" name="description" rows={3} placeholder="Describe the product" /></div>
              </div>
              <div className="product-form-footer"><label className="active-check"><input type="checkbox" name="is_active" defaultChecked /> <span>Active product</span></label><PendingButton className="add-product-button" pendingText="Adding product…">＋ Add product</PendingButton></div>
            </form>
          </section>

          <section className="admin-panel records-panel">
            <div className="panel-heading records-heading"><div><h2>Product records</h2><p>{products.length} {products.length === 1 ? 'product' : 'products'} in your catalog</p></div><span className="records-count">{products.length} TOTAL</span></div>
            {products.length === 0 ? <div className="empty-products"><span aria-hidden="true">▧</span><strong>No products yet</strong><p>Add your first product using the form above.</p></div> : (
              <div className="product-table-wrap"><table className="product-table"><thead><tr><th>Product</th><th>Brand</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {products.map((product) => <tr key={product.product_id}>
                  <td><div className="product-cell">{product.image ? <img src={product.image} alt="" className="product-thumb" /> : <span className="product-thumb product-placeholder" aria-hidden="true">▧</span>}<div><strong>{product.name}</strong><small>#{product.product_id}{product.description ? ` · ${product.description}` : ''}</small></div></div></td>
                  <td>{product.brand || '—'}</td><td className="price-cell">{money(product.base_price)}</td><td>{money(product.cost_price)}</td><td>{product.product_variant?.length ? product.product_variant.map((variant) => <form action={updateProductStock} className="stock-edit-form" key={variant.variant_id}><input type="hidden" name="variant_id" value={variant.variant_id} /><small>{variant.size} · {variant.color}</small><input aria-label={`Stock quantity for ${product.name}, ${variant.size} ${variant.color}`} type="number" min="0" step="1" name="stock_quantity" defaultValue={variant.stock_quantity ?? 0} /><PendingButton className="stock-save-button" pendingText="…">Save</PendingButton></form>) : <span>—</span>}</td>
                  <td><span className={`product-status ${product.is_active ? 'is-active' : 'is-inactive'}`}><i />{product.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>{product.created_at ? new Date(product.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                  <td><div className="product-actions"><Link className="edit-product-button" href={`/admin/products/${product.product_id}/edit`}>Edit</Link><form action={deleteProduct}><input type="hidden" name="product_id" value={product.product_id} /><PendingButton className="delete-product-button" pendingText="Deleting…" ariaLabel={`Delete ${product.name}`}>Delete</PendingButton></form></div></td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
          <p className="admin-footer-note">Changes are saved directly to your shared Resilico and Novyr database.</p>
        </div>
      </section>
    </main>
  )
}
