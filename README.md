# Resilico

Resilico is a server-rendered Next.js apparel storefront with customer accounts, an admin product dashboard, and a shared Supabase/Postgres database.

## Run locally

Install dependencies and start the Next.js development server:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. The app reads Supabase and session settings from `.env.local`.

## Ordering and J&T Express

Before using checkout, run `supabase/migrations/202610290001_create_orders_and_jnt_shipments.sql` in the Supabase SQL editor. This adds inventory, orders, order items, shipment records, and an atomic order placement function. Stock defaults to zero; set each product's stock in **Admin → Products** before it can be ordered.

Customers can add catalog products to their order bag, enter a Philippine delivery address, place an order, and view order status at **My orders**. Orders reserve stock and create a shipment record with carrier `J&T Express`. Admins can use **Orders & J&T** to enter the J&T tracking number and update shipment status after booking the parcel in J&T's system.

The current foundation stores tracking information but does not call J&T's booking or tracking API. Live carrier integration needs J&T API credentials and an enabled merchant account; none are configured in this project. Payment processing is also not configured, so orders are created with `Pending` status.

### Ordering API

The API is versioned under `/api/v1` and uses the existing signed Resilico session cookie.

- `POST /api/v1/orders` — place an order. JSON body: `{ "items": [{ "productId": 1, "quantity": 2 }], "shipping": { "name": "Customer Name", "phone": "09...", "addressLine1": "Street", "city": "City", "province": "Province", "postalCode": "0000", "country": "Philippines" } }`.
- `GET /api/v1/orders` — list the signed-in customer's orders; admins see all orders.
- `GET /api/v1/orders/{id}` — view an order, its items, and its shipment (owner or admin).
- `GET /api/v1/shipments?orderId={id}` — retrieve shipment tracking (owner or admin).
- `PATCH /api/v1/shipments/{id}` — admin update, for example `{ "trackingNumber": "JT1234567890", "shippingStatus": "In Transit", "shippedAt": "2026-10-29T08:00:00Z" }`.

Errors use a consistent JSON shape with `success`, `statusCode`, `message`, `errors`, and `timestamp`. The supplied Lab 05 describes a broader 39-endpoint API; this implementation establishes the order and J&T fulfillment path first.

## Share locally with ngrok

With the app running, open a second terminal and run:

```powershell
ngrok http 3000
```

Open the HTTPS forwarding URL ngrok prints. Keep the tunnel running while sharing the site. To use a reserved ngrok domain, pass that assigned domain with ngrok's `--url` option.
