import { apiContext, dbHeaders, jsonError } from '../../_lib'

type ShipmentUpdate = {
  trackingNumber?: string | null
  shippingStatus?: string
  shippedAt?: string | null
  estimatedDelivery?: string | null
}

type UpdatedShipment = {
  order_id: number
  shipping_status: string
}

const allowedShippingStatuses = ['Preparing', 'In Transit', 'Delivered', 'Returned']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await apiContext()

  if (!context) {
    return jsonError(401, 'Authentication required.')
  }

  if (context.user.role !== 'admin') {
    return jsonError(403, 'Admin access required.')
  }

  const { id: shipmentId } = await params
  if (!/^\d+$/.test(shipmentId)) {
    return jsonError(400, 'Shipment ID must be a number.')
  }

  let update: ShipmentUpdate
  try {
    update = (await request.json()) as ShipmentUpdate
  } catch {
    return jsonError(400, 'Request body must be valid JSON.')
  }

  if (
    update.shippingStatus !== undefined &&
    !allowedShippingStatuses.includes(update.shippingStatus)
  ) {
    return jsonError(400, 'Invalid shippingStatus.', [
      `Use one of: ${allowedShippingStatuses.join(', ')}.`,
    ])
  }

  if (
    update.trackingNumber !== undefined &&
    update.trackingNumber !== null &&
    update.trackingNumber.trim().length > 80
  ) {
    return jsonError(400, 'Tracking number is too long.')
  }

  const databaseUpdate: Record<string, string | null> = {}

  if (update.trackingNumber !== undefined) {
    databaseUpdate.tracking_number = update.trackingNumber?.trim() || null
  }

  if (update.shippingStatus !== undefined) {
    databaseUpdate.shipping_status = update.shippingStatus
  }

  if (update.shippedAt !== undefined) {
    databaseUpdate.shipped_at = update.shippedAt
  }

  if (update.estimatedDelivery !== undefined) {
    databaseUpdate.estimated_delivery = update.estimatedDelivery
  }

  if (Object.keys(databaseUpdate).length === 0) {
    return jsonError(400, 'Provide at least one shipment field to update.')
  }

  const shipmentFilters = new URLSearchParams({
    shipment_id: `eq.${shipmentId}`,
    select: '*',
  })

  const shipmentResponse = await fetch(
    `${context.config.url}/rest/v1/shipments?${shipmentFilters}`,
    {
      method: 'PATCH',
      headers: dbHeaders(context.config, 'return=representation'),
      body: JSON.stringify(databaseUpdate),
      cache: 'no-store',
    },
  )

  if (shipmentResponse.status === 409) {
    return jsonError(409, 'Tracking number is already in use.')
  }

  if (!shipmentResponse.ok) {
    const databaseError = await shipmentResponse.text()
    let message = databaseError
    let code = ''
    try {
      const parsed = JSON.parse(databaseError) as { code?: string; message?: string; details?: string; hint?: string }
      code = parsed.code ?? ''
      message = [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(' ')
    } catch {
      // Preserve the raw database response as a troubleshooting detail.
    }
    if (code === '42501' || message.toLowerCase().includes('permission denied')) {
      return jsonError(503, 'Supabase does not allow the shipment update.', [
        'Run GRANT SELECT, UPDATE ON public.shipments TO service_role in the Supabase SQL Editor.',
      ])
    }
    if (code === '23505') return jsonError(409, 'Tracking number is already in use.')
    return jsonError(500, 'Shipment could not be updated.', message ? [message] : [])
  }

  const updatedShipments = (await shipmentResponse.json()) as UpdatedShipment[]
  const shipment = updatedShipments[0]

  if (!shipment) {
    return jsonError(404, 'Shipment not found.')
  }

  const orderStatus =
    shipment.shipping_status === 'In Transit'
      ? 'shipped'
      : shipment.shipping_status === 'Delivered'
        ? 'delivered'
        : null

  if (orderStatus) {
    const orderResponse = await fetch(
      `${context.config.url}/rest/v1/orders?order_id=eq.${shipment.order_id}`,
      {
        method: 'PATCH',
        headers: dbHeaders(context.config),
        body: JSON.stringify({ status: orderStatus }),
        cache: 'no-store',
      },
    )

    if (!orderResponse.ok) {
      const databaseError = await orderResponse.text()
      let message = databaseError
      try {
        const parsed = JSON.parse(databaseError) as { message?: string; details?: string; hint?: string }
        message = [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(' ')
      } catch {
        // Keep the raw response as a troubleshooting detail.
      }
      return jsonError(500, 'Shipment was saved, but order status could not be synchronized.', message ? [message] : [])
    }
  }

  return Response.json(shipment)
}
