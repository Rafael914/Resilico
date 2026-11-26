import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '../auth/session'
import CheckoutForm from './CheckoutForm'
import '../orders/orders.css'

export default async function CheckoutPage() {
  const jar = await cookies()
  if (!verifySession(jar.get('resilico-session')?.value)) redirect('/login?message=session-expired')
  return <main className="orders-page"><header className="orders-header"><Link href="/dashboard" className="orders-brand">resilico</Link><Link href="/orders">My orders</Link></header><div className="orders-content"><p className="orders-eyebrow">CHECKOUT · J&amp;T EXPRESS</p><h1>Place your order</h1><p className="orders-intro">Add your delivery details and submit your Resilico order.</p><CheckoutForm /></div></main>
}
