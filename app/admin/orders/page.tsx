import { redirect } from 'next/navigation'
import Link from 'next/link'
import { adminDatabaseConfig, getCurrentAdmin } from '../security'
import { dbHeaders } from '../../api/v1/_lib'
import ShipmentEditor from './ShipmentEditor'
import './orders.css'

type Order = { order_id: number; user_id: number; status: string; total_amount: number | string; created_at: string; shipping_name: string; shipping_phone: string; shipping_address_line1: string; shipping_address_line2: string | null; shipping_city: string; shipping_province: string; shipping_postal_code: string }
type Shipment = { shipment_id: number; order_id: number; tracking_number: string | null; shipping_status: string; shipped_at: string | null }

export default async function AdminOrdersPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login?message=admin-only')
  const config = adminDatabaseConfig()
  if (!config) redirect('/admin?status=configuration')
  const response = await fetch(`${config.url}/rest/v1/orders?select=*&order=created_at.desc&limit=100`, { headers: dbHeaders(config), cache: 'no-store' })
  const orders = response.ok ? await response.json() as Order[] : []
  const shipmentResponse = orders.length ? await fetch(`${config.url}/rest/v1/shipments?order_id=in.(${orders.map((order) => order.order_id).join(',')})&select=*`, { headers: dbHeaders(config), cache: 'no-store' }) : null
  const shipments = shipmentResponse?.ok ? await shipmentResponse.json() as Shipment[] : []
  return <main className="admin-orders-page"><header><Link href="/admin">← Products</Link><span>RESILICO · FULFILLMENT</span></header><section><p className="admin-orders-eyebrow">J&amp;T EXPRESS</p><h1>Orders &amp; shipments</h1><p className="admin-orders-intro">Book the shipment in your J&amp;T account, then add the tracking number and update its status here.</p>{!response.ok ? <p>Orders could not be loaded. Apply the orders migration first.</p> : orders.length === 0 ? <p className="admin-orders-empty">No orders yet.</p> : <div className="admin-order-list">{orders.map((order) => { const shipment = shipments.find((item) => item.order_id === order.order_id); return <article className="admin-order-card" key={order.order_id}><div className="admin-order-head"><div><span>ORDER #{order.order_id} · CUSTOMER #{order.user_id}</span><h2>{order.status}</h2></div><strong>{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(order.total_amount))}</strong></div><div className="admin-shipping-address"><strong>{order.shipping_name}</strong> · {order.shipping_phone}<br />{order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ''}, {order.shipping_city}, {order.shipping_province} {order.shipping_postal_code}</div>{shipment && <ShipmentEditor shipmentId={shipment.shipment_id} trackingNumber={shipment.tracking_number} shippingStatus={shipment.shipping_status} shippedAt={shipment.shipped_at} />}</article> })}</div>}</section></main>
}
