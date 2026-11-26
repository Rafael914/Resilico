'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

const cartKey = 'resilico-order-cart'
type CartItem = { productId: number; quantity: number }

export default function CheckoutForm() {
  const [items, setItems] = useState<CartItem[]>([])
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setItems(JSON.parse(localStorage.getItem(cartKey) || '[]') as CartItem[]) }, [])
  function changeQuantity(productId: number, quantity: number) {
    const next = items.map((item) => item.productId === productId ? { ...item, quantity } : item).filter((item) => item.quantity > 0)
    setItems(next)
    localStorage.setItem(cartKey, JSON.stringify(next))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError('')
    const data = new FormData(event.currentTarget)
    const response = await fetch('/api/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      items,
      shipping: { name: data.get('name'), phone: data.get('phone'), addressLine1: data.get('addressLine1'), addressLine2: data.get('addressLine2'), city: data.get('city'), province: data.get('province'), postalCode: data.get('postalCode'), country: 'Philippines' },
    }) })
    const result = await response.json()
    setSaving(false)
    if (!response.ok) { setError(result.errors?.join(' ') || result.message || 'Order could not be placed.'); return }
    setOrderId(result.orderId)
    localStorage.removeItem(cartKey)
  }
  if (orderId) return <div className="checkout-confirmation"><span>ORDER #{orderId}</span><h1>Your order is in.</h1><p>We’ll prepare it for J&amp;T Express. Tracking details will appear in your order history after the shipment is booked.</p><Link href="/orders">View my orders</Link></div>
  return <form className="checkout-form" onSubmit={submit}>
    <section className="checkout-panel"><h2>Your items</h2>{items.length ? items.map((item) => <div className="checkout-item" key={item.productId}><span>Product #{item.productId}</span><label>Qty <input type="number" min="0" max="99" value={item.quantity} onChange={(event) => changeQuantity(item.productId, Number(event.target.value))} /></label></div>) : <p>Your order bag is empty. <Link href="/dashboard">Browse products</Link></p>}</section>
    <section className="checkout-panel"><h2>Delivery address</h2><div className="checkout-fields">
      <label>Recipient name<input name="name" autoComplete="name" required maxLength={120} /></label><label>Phone number<input name="phone" autoComplete="tel" required maxLength={30} /></label>
      <label className="checkout-wide">Address line 1<input name="addressLine1" autoComplete="address-line1" required maxLength={255} /></label><label className="checkout-wide">Address line 2 <span>(optional)</span><input name="addressLine2" autoComplete="address-line2" maxLength={255} /></label>
      <label>City / municipality<input name="city" autoComplete="address-level2" required maxLength={100} /></label><label>Province<input name="province" autoComplete="address-level1" required maxLength={100} /></label><label>Postal code<input name="postalCode" autoComplete="postal-code" required maxLength={12} /></label>
    </div><p className="checkout-note">J&amp;T Express delivery · Payment handling can be added when your payment method is configured.</p>{error && <p className="checkout-error" role="alert">{error}</p>}<button className="checkout-submit" disabled={!items.length || saving}>{saving ? 'Placing order…' : 'Place order'}</button></section>
  </form>
}
