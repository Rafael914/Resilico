import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '../admin/security'
import { adminDatabaseConfig } from '../admin/security'
import { dbHeaders } from '../api/v1/_lib'
import './orders.css'

type Order = { order_id: number; status: string; total_amount: number | string; created_at: string }
type Shipment = { order_id: number; tracking_number: string | null; shipping_status: string; carrier: string }

export default async function OrdersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const config = adminDatabaseConfig()
  if (!config) redirect('/login?message=configuration')
  const query = new URLSearchParams({ select: '*', user_id: `eq.${user.user_id}`, order: 'created_at.desc' })
  const response = await fetch(`${config.url}/rest/v1/orders?${query}`, { headers: dbHeaders(config), cache: 'no-store' })
  const orders = response.ok ? await response.json() as Order[] : []
  const shipmentsResponse = orders.length ? await fetch(`${config.url}/rest/v1/shipments?order_id=in.(${orders.map((order) => order.order_id).join(',')})&select=order_id,tracking_number,shipping_status,carrier`, { headers: dbHeaders(config), cache: 'no-store' }) : null
  const shipments = shipmentsResponse?.ok ? await shipmentsResponse.json() as Shipment[] : []
  return <main className="orders-page"><header className="orders-header"><Link href="/dashboard" className="orders-brand">resilico</Link><Link href="/checkout">Order bag</Link></header><div className="orders-content"><p className="orders-eyebrow">YOUR ACCOUNT</p><h1>My orders</h1><p className="orders-intro">Check your order status and J&amp;T tracking details.</p>
    {!response.ok ? <p className="orders-empty">Orders could not be loaded right now.</p> : orders.length === 0 ? <div className="orders-empty"><p>No orders yet.</p><Link href="/dashboard">Explore the collection</Link></div> : <div className="orders-list">{orders.map((order) => { const shipment = shipments.find((item) => item.order_id === order.order_id); return <article className="order-card" key={order.order_id}><div className="order-card-heading"><div><span>ORDER #{order.order_id}</span><h2>{order.status}</h2></div><time>{new Date(order.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</time></div><div className="order-card-details"><span>Total <strong>{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(order.total_amount))}</strong></span><span>{shipment?.carrier || 'J&T Express'} <strong>{shipment?.shipping_status || 'Preparing'}</strong></span><span>Tracking <strong>{shipment?.tracking_number || 'Pending booking'}</strong></span></div></article> })}</div>}
  </div></main>
}
