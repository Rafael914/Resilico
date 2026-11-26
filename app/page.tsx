import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from './auth/session'
import { adminDatabaseConfig } from './admin/security'
import './styles/storefront.css'

type Product = {
  product_id: number
  name: string
  description: string | null
  base_price: number | string
  brand: string | null
  image: string | null
}

function price(value: number | string) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
    : 'Price unavailable'
}

export default async function Home() {
  const jar = await cookies()
  const token = jar.get('resilico-session')?.value
  const session = verifySession(token)
  if (session) {
    const config = adminDatabaseConfig()
    if (!config) redirect('/login?message=configuration')
    const params = new URLSearchParams({ select: 'role', user_id: `eq.${session.user_id}`, limit: '1' })
    let users: { role: string }[] = []
    try {
      const response = await fetch(`${config.url}/rest/v1/users?${params}`, {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: 'no-store',
      })
      if (response.ok) users = await response.json() as { role: string }[]
    } catch {
      redirect('/login?message=configuration')
    }
    const user = users[0]
    if (!user) redirect('/login?message=session-expired')
    redirect(user.role === 'admin' ? '/admin' : '/dashboard')
  }
  if (token) redirect('/login?message=session-expired')

  const config = adminDatabaseConfig()
  let products: Product[] = []
  let catalogUnavailable = !config
  if (config) {
    const params = new URLSearchParams({
      select: 'product_id,name,description,base_price,brand,image',
      is_active: 'eq.true',
      order: 'created_at.desc',
      limit: '4',
    })
    try {
      const response = await fetch(`${config.url}/rest/v1/products?${params}`, {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: 'no-store',
      })
      if (response.ok) {
        products = await response.json() as Product[]
        catalogUnavailable = false
      } else {
        catalogUnavailable = true
      }
    } catch {
      catalogUnavailable = true
    }
  }

  const feature = products[0]
  return (
    <main className="storefront">
      <div className="announcement-bar">RESILICO APPAREL <span>·</span> CLOTHING FOR EVERYDAY LIFE</div>
      <header className="store-header">
        <Link className="store-brand" href="/" aria-label="Resilico home"><span className="store-brand-mark">R</span><span>resilico</span></Link>
        <nav className="store-nav" aria-label="Main navigation"><a href="#about">Our story</a><a href="#collection">Collection</a></nav>
        <div className="store-account-links"><Link className="store-login" href="/login">Sign in</Link><Link className="store-register" href="/register">Create account <span aria-hidden="true">↗</span></Link></div>
      </header>

      <section className="store-hero">
        <div className="store-hero-copy">
          <p className="store-eyebrow"><span /> MADE FOR YOUR EVERYDAY</p>
          <h1>Wear what<br />moves <em>you.</em></h1>
          <p className="store-hero-description">Thoughtful apparel for real life. Discover versatile pieces designed to feel good, fit your day, and go wherever you do.</p>
          <div className="store-hero-actions"><a className="store-primary-cta" href="#collection">Explore the collection <span aria-hidden="true">↓</span></a><a className="store-text-cta" href="#about">Get to know us <span aria-hidden="true">↗</span></a></div>
          <div className="store-hero-footnote"><span>01</span><span>EVERYDAY ESSENTIALS</span><i /></div>
        </div>
        <div className="store-hero-art">
          {feature?.image ? <img className="store-hero-image" src={feature.image} alt={feature.name} /> : <div className="hero-abstract"><div className="abstract-sun" /><div className="abstract-shape" /><span className="abstract-word">RESI<br />LICO</span></div>}
          <div className="hero-image-label"><span>THE RESILICO EDIT</span><span>EST. FOR EVERY DAY</span></div>
          <div className="hero-floating-note"><span>R.</span><small>MADE TO<br />MOVE WITH YOU</small></div>
        </div>
        <div className="hero-side-label">APPAREL · EVERYDAY · RESILICO</div>
      </section>

      <section className="store-intro" id="about">
        <p className="store-eyebrow">A LITTLE ABOUT US</p>
        <div className="store-intro-grid"><h2>Clothes for the<br /><em>life you live.</em></h2><div><p>Resilico is an apparel company built around the way people actually live: full days, changing plans, and moments worth showing up for.</p><p>We make clothing that brings comfort, character, and everyday versatility together—so getting dressed feels like the easy part.</p><Link href="/register" className="store-inline-link">Become part of Resilico <span aria-hidden="true">↗</span></Link></div></div>
      </section>

      <section className="store-collection" id="collection">
        <div className="collection-heading"><div><p className="store-eyebrow">THE CURRENT LINEUP</p><h2>Made for the everyday.</h2></div><span>{products.length ? `01 — 0${products.length}` : 'NEW COLLECTION'}</span></div>
        {products.length ? <div className="store-product-grid">{products.map((product, index) => <article className="store-product" key={product.product_id}>
          <div className="store-product-image-wrap">{product.image ? <img src={product.image} alt={product.name} className="store-product-image" /> : <div className={`store-product-placeholder tone-${index % 4}`}><span>R.</span></div>}<span className="product-index">0{index + 1}</span></div>
          <div className="store-product-meta"><div><p>{product.brand || 'RESILICO'}</p><h3>{product.name}</h3></div><strong>{price(product.base_price)}</strong></div>
          {product.description && <p className="store-product-description">{product.description}</p>}
        </article>)}</div> : <div className="collection-empty"><p>{catalogUnavailable ? 'The collection is temporarily unavailable.' : 'We’re getting the first pieces ready.'}</p><span>{catalogUnavailable ? 'Please check the database connection and try again.' : 'Check back soon for the Resilico collection.'}</span></div>}
      </section>

      <section className="store-signup-band"><div><p className="store-eyebrow">GOOD THINGS, ON YOUR TIME</p><h2>Stay in the loop.</h2><p>Create an account to keep up with the collection and what’s new at Resilico.</p></div><Link href="/register" className="store-primary-cta">Join Resilico <span aria-hidden="true">↗</span></Link></section>
      <footer className="store-footer"><Link className="store-brand" href="/"><span className="store-brand-mark">R</span><span>resilico</span></Link><span>APPAREL FOR EVERYDAY LIFE</span><span>© {new Date().getFullYear()} RESILICO COMPANY</span></footer>
    </main>
  )
}
