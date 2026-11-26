import { apiContext, dbHeaders, jsonError } from '../_lib'

type OrderOwner = {
  order_id: number
  user_id: number
}

export async function GET(request: Request) {
  const context = await apiContext()

  if (!context) {
    return jsonError(401, 'Authentication required.')
  }

  const orderId = new URL(request.url).searchParams.get('orderId')
  if (!orderId || !/^\d+$/.test(orderId)) {
    return jsonError(400, 'orderId is required and must be numeric.')
  }

  const orderFilters = new URLSearchParams({
    select: 'order_id,user_id',
    order_id: `eq.${orderId}`,
    limit: '1',
  })

  const orderResponse = await fetch(
    `${context.config.url}/rest/v1/orders?${orderFilters}`,
    {
      headers: dbHeaders(context.config),
      cache: 'no-store',
    },
  )

  if (!orderResponse.ok) {
    return jsonError(500, 'Order could not be loaded.')
  }

  const orders = (await orderResponse.json()) as OrderOwner[]
  const order = orders[0]

  if (!order) {
    return jsonError(404, 'Order not found.')
  }

  const isAdmin = context.user.role === 'admin'
  const isOrderOwner = order.user_id === context.user.user_id

  if (!isAdmin && !isOrderOwner) {
    return jsonError(403, 'Access denied.')
  }

  const shipmentFilters = new URLSearchParams({
    order_id: `eq.${orderId}`,
    select: '*',
  })

  const shipmentResponse = await fetch(
    `${context.config.url}/rest/v1/shipments?${shipmentFilters}`,
    {
      headers: dbHeaders(context.config),
      cache: 'no-store',
    },
  )

  if (!shipmentResponse.ok) {
    return jsonError(500, 'Shipment could not be loaded.')
  }

  const shipments = await shipmentResponse.json()
  return Response.json(shipments)
}
