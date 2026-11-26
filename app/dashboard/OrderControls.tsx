'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const cartKey = 'resilico-order-cart'

export function AddToOrder({ productId }: { productId: number }) {
  const [added, setAdded] = useState(false)
  function add() {
    const current = JSON.parse(localStorage.getItem(cartKey) || '[]') as { productId: number; quantity: number }[]
    const item = current.find((entry) => entry.productId === productId)
    if (item) item.quantity = Math.min(item.quantity + 1, 99)
    else current.push({ productId, quantity: 1 })
    localStorage.setItem(cartKey, JSON.stringify(current))
    window.dispatchEvent(new Event('resilico-cart-updated'))
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1500)
  }
  return <button className="order-add-button" type="button" onClick={add}>{added ? 'Added to order' : 'Add to order'}</button>
}

export function OrderLinks() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    function updateCount() {
    const items = JSON.parse(localStorage.getItem(cartKey) || '[]') as { quantity: number }[]
    setCount(items.reduce((sum, item) => sum + item.quantity, 0))
    }
    updateCount()
    window.addEventListener('resilico-cart-updated', updateCount)
    return () => window.removeEventListener('resilico-cart-updated', updateCount)
  }, [])
  return <><Link className="order-nav-link" href="/orders">My orders</Link><Link className="order-nav-link" href="/checkout">Order bag{count ? ` (${count})` : ''}</Link></>
}
