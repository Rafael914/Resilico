import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { signOut } from '../auth/actions'
import { verifySession } from '../auth/session'
import { adminDatabaseConfig } from '../admin/security'
import { AddToOrder, OrderLinks } from './OrderControls'
import './dashboard.css'

type Product = {
  product_id: number
  name: string
  description: string | null
  base_price: number | string
  brand: string | null
  image: string | null
}

function formatPrice(value: number | string) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
    : 'Price unavailable'
}

export default async function CustomerDashboard() {
  const config = adminDatabaseConfig()
  const jar = await cookies()
  const session = verifySession(jar.get('resilico-session')?.value)
  if (!session) redirect('/login')
  if (!config) redirect('/login?message=configuration')

  const userQuery = new URLSearchParams({
    select: 'user_id,first_name,last_name,email,role',
    user_id: `eq.${session.user_id}`,
    limit: '1',
  })
  const userResponse = await fetch(`${config.url}/rest/v1/users?${userQuery}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  const users = userResponse.ok ? await userResponse.json() as { user_id: number; first_name: string; last_name: string; email: string; role: string }[] : []
  const user = users[0]
  if (!user) redirect('/login')
  if (user.role === 'admin') redirect('/admin')

  const query = new URLSearchParams({
    select: 'product_id,name,description,base_price,brand,image',
    is_active: 'eq.true',
    order: 'created_at.desc',
  })
  const response = await fetch(`${config.url}/rest/v1/products?${query}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  })
  const products = response.ok ? await response.json() as Product[] : []

  return (
    <main className="customer-page">
      <header className="customer-header">
        <Link className="customer-brand" href="/dashboard"><span className="brand-mark">R</span><span>resilico</span></Link>
        <div className="customer-account"><OrderLinks /><span className="customer-greeting">Hi, {user.first_name}</span><form action={signOut}><button type="submit" className="customer-signout">Sign out</button></form></div>
      </header>

      <section className="customer-hero">
        <div><p className="customer-eyebrow">THE RESILICO COLLECTION</p><h1>Find something you love.</h1><p>Explore the latest products selected for you.</p></div>
        <span className="collection-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
      </section>

      {!response.ok ? <div className="customer-empty"><span aria-hidden="true">⌁</span><h2>Products are unavailable right now</h2><p>Please refresh the page in a moment.</p></div> : products.length === 0 ? (
        <div className="customer-empty"><span aria-hidden="true">⌁</span><h2>New products are on the way</h2><p>There are no active products to show yet. Please check back soon.</p></div>
      ) : (
        <section className="customer-products" aria-label="Available products">
          {products.map((product) => (
            <article className="customer-product-card" key={product.product_id}>
              <div className="customer-product-image-wrap">
                {product.image ? <img className="customer-product-image" src={product.image} alt={product.name} /> : <div className="customer-product-placeholder" aria-label="No product image">R</div>}
              </div>
              <div className="customer-product-info">
                {product.brand && <p className="customer-product-brand">{product.brand}</p>}
                <h2>{product.name}</h2>
                {product.description && <p className="customer-product-description">{product.description}</p>}
                <strong className="customer-product-price">{formatPrice(product.base_price)}</strong>
                <AddToOrder productId={product.product_id} />
              </div>
            </article>
          ))}
        </section>
      )}

      <footer className="customer-footer">© Resilico Company</footer>
    </main>
  )
}
