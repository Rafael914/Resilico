import { apiContext, dbHeaders, jsonError } from '../../_lib'

type OrderOwner = {
  order_id: number
  user_id: number
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await apiContext()

  if (!context) {
    return jsonError(401, 'Authentication required.')
  }

  const { id: orderId } = await params
  if (!/^\d+$/.test(orderId)) {
    return jsonError(400, 'Order ID must be a number.')
  }

  const orderFilters = new URLSearchParams({
    select: '*',
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

  const itemsUrl = `${context.config.url}/rest/v1/order_items?order_id=eq.${orderId}&select=*`
  const shipmentsUrl = `${context.config.url}/rest/v1/shipments?order_id=eq.${orderId}&select=*`

  const [itemsResponse, shipmentsResponse] = await Promise.all([
    fetch(itemsUrl, { headers: dbHeaders(context.config), cache: 'no-store' }),
    fetch(shipmentsUrl, { headers: dbHeaders(context.config), cache: 'no-store' }),
  ])

  if (!itemsResponse.ok || !shipmentsResponse.ok) {
    return jsonError(500, 'Order details could not be loaded.')
  }

  const items = await itemsResponse.json()
  const shipments = await shipmentsResponse.json()

  return Response.json({ ...order, items, shipments })
}
