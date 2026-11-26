import { apiContext, dbHeaders, jsonError } from '../_lib'

type OrderItemInput = {
  productId?: number
  quantity?: number
}

type ShippingAddressInput = {
  name?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

type OrderInput = {
  items?: OrderItemInput[]
  shipping?: ShippingAddressInput
}

function validateOrder(items: OrderItemInput[] | undefined, shipping: ShippingAddressInput | undefined) {
  const errors: string[] = []

  if (!items?.length) {
    errors.push('Add at least one product.')
  }

  const hasInvalidItem = items?.some((item) => {
    return (
      !Number.isInteger(item.productId) ||
      Number(item.productId) < 1 ||
      !Number.isInteger(item.quantity) ||
      Number(item.quantity) < 1 ||
      Number(item.quantity) > 99
    )
  })

  if (hasInvalidItem) {
    errors.push('Each item needs a valid productId and a quantity from 1 to 99.')
  }

  const requiredAddressFields = [
    shipping?.name,
    shipping?.phone,
    shipping?.addressLine1,
    shipping?.city,
    shipping?.province,
    shipping?.postalCode,
  ]

  if (requiredAddressFields.some((field) => !field?.trim())) {
    errors.push('Name, phone, street address, city, province and postal code are required.')
  }

  return errors
}

function combineDuplicateItems(items: OrderItemInput[]) {
  const quantitiesByProduct = new Map<number, number>()

  for (const item of items) {
    const productId = item.productId!
    const quantity = item.quantity!
    const currentQuantity = quantitiesByProduct.get(productId) ?? 0
    quantitiesByProduct.set(productId, currentQuantity + quantity)
  }

  return [...quantitiesByProduct].map(([productId, quantity]) => ({ productId, quantity }))
}

export async function POST(request: Request) {
  const context = await apiContext()

  if (!context) {
    return jsonError(401, 'Authentication required.')
  }

  if (context.user.role === 'admin') {
    return jsonError(403, 'Only customer accounts can place orders.')
  }

  let orderInput: OrderInput
  try {
    orderInput = (await request.json()) as OrderInput
  } catch {
    return jsonError(400, 'Request body must be valid JSON.')
  }

  const validationErrors = validateOrder(orderInput.items, orderInput.shipping)
  if (validationErrors.length) {
    return jsonError(400, 'Validation failed.', validationErrors)
  }

  const orderItems = combineDuplicateItems(orderInput.items!)
  const quantityLimitExceeded = orderItems.some((item) => item.quantity > 99)

  if (quantityLimitExceeded) {
    return jsonError(400, 'Validation failed.', [
      'Combined quantity for a product cannot exceed 99.',
    ])
  }

  const response = await fetch(`${context.config.url}/rest/v1/rpc/place_resilico_order`, {
    method: 'POST',
    headers: dbHeaders(context.config),
    body: JSON.stringify({
      p_user_id: context.user.user_id,
      p_items: orderItems,
      p_shipping: orderInput.shipping,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const databaseError = await response.text()
    let databaseMessage = databaseError
    let databaseCode = ''
    try {
      const parsed = JSON.parse(databaseError) as { code?: string; message?: string; details?: string; hint?: string }
      databaseCode = parsed.code ?? ''
      databaseMessage = [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(' ')
    } catch {
      // Keep the raw response for a useful fallback message below.
    }

    if (databaseMessage.toLowerCase().includes('insufficient stock')) {
      return jsonError(409, 'Insufficient stock.', [
        'One or more items no longer have enough inventory.',
      ])
    }

    if (databaseMessage.toLowerCase().includes('unavailable')) {
      return jsonError(404, 'Product unavailable.', [
        'One or more products are no longer available.',
      ])
    }

    if (databaseCode === 'PGRST202' || databaseMessage.includes('place_resilico_order')) {
      return jsonError(503, 'Checkout database setup is missing or out of date.', [
        'Run the updated 202610290001_create_orders_and_jnt_shipments.sql migration in the Supabase SQL Editor.',
      ])
    }

    if (databaseCode === '42501' || databaseMessage.toLowerCase().includes('permission denied')) {
      return jsonError(503, 'Supabase permissions are preventing checkout.', [
        'Grant service_role access to orders, order_items, shipments, and product_variant, then retry.',
      ])
    }

    return jsonError(400, 'Order could not be placed.', databaseMessage ? [databaseMessage] : [])
  }

  const orderId = (await response.json()) as number

  return Response.json(
    {
      orderId,
      userId: context.user.user_id,
      status: 'pending',
      carrier: 'J&T Express',
      shippingStatus: 'Preparing',
      message: 'Order placed. J&T tracking will appear after the shipment is booked.',
    },
    { status: 201 },
  )
}

export async function GET() {
  const context = await apiContext()

  if (!context) {
    return jsonError(401, 'Authentication required.')
  }

  const filters = new URLSearchParams({
    select: '*',
    order: 'created_at.desc',
  })

  if (context.user.role !== 'admin') {
    filters.set('user_id', `eq.${context.user.user_id}`)
  }

  const response = await fetch(`${context.config.url}/rest/v1/orders?${filters}`, {
    headers: dbHeaders(context.config),
    cache: 'no-store',
  })

  if (!response.ok) {
    return jsonError(500, 'Orders could not be loaded.')
  }

  const orders = await response.json()
  return Response.json(orders)
}
