'use client'

import { FormEvent, useState } from 'react'

export default function ShipmentEditor({ shipmentId, trackingNumber, shippingStatus, shippedAt }: { shipmentId: number; trackingNumber: string | null; shippingStatus: string; shippedAt: string | null }) {
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const form = new FormData(event.currentTarget)
    const tracking = String(form.get('trackingNumber') || '').trim()
    const status = String(form.get('shippingStatus') || 'Preparing')
    try {
      const response = await fetch(`/api/v1/shipments/${shipmentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackingNumber: tracking || null, shippingStatus: status, ...(status === 'In Transit' && !shippedAt ? { shippedAt: new Date().toISOString() } : {}) }) })
      const result = await response.json()
      setMessage(response.ok ? 'Saved' : result.errors?.join(' ') || result.message || 'Could not save')
    } catch {
      setMessage('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }
  return <form className="shipment-editor" onSubmit={save}><label>J&amp;T tracking number<input name="trackingNumber" defaultValue={trackingNumber || ''} placeholder="Enter after booking" maxLength={80} /></label><label>Status<select name="shippingStatus" defaultValue={shippingStatus}><option>Preparing</option><option>In Transit</option><option>Delivered</option><option>Returned</option></select></label><button type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save tracking'}</button>{message && <span role="status">{message}</span>}</form>
}
