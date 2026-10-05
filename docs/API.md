# IndustrialFlow API

Base URL: `http://localhost:4000/api` (or the frontend `VITE_API_URL`). Protected calls use `Authorization: Bearer <JWT>`.

All successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "message": "…", "code": "…" }`. Common codes are `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INVALID_STATE`, `INSUFFICIENT_STOCK`, `DUPLICATE_OPERATION`, and `CONFLICT`.

## Authentication

### `POST /auth/login`

Public. Authenticates a seeded or managed user and records a `LOGIN` audit event.

```json
{ "email": "sales@industrialflow.local", "password": "IndustrialFlow@123" }
```

Returns a JWT and safe user object; password hashes are never returned. Invalid credentials return `401 UNAUTHORIZED` with a deliberately generic message.

### `GET /auth/me`

JWT required; any role. Returns `{ id, name, email, role }` for the token’s active user. Invalid, expired, or deleted-user tokens return `401`.

## Customers

### `GET /customers`

JWT required; any role. Lists customers alphabetically.

### `POST /customers`

JWT required; `ADMIN` or `SALES_USER`. Creates a customer.

```json
{ "companyName": "Acme Industrial", "contactPerson": "Ravi Kumar", "mobile": "+91 9876500000", "email": "ravi@acme.example", "city": "Pune" }
```

Returns `201`. Company, contact, mobile, email, and city are validated.

## Products and inventory

### `GET /products`

JWT required; any role. Lists product code, product details, and current base price. Products are seeded, not browser-managed.

### `GET /inventory`

JWT required; any role. Returns product, `physicalQuantity`, `reservedQuantity`, and derived `availableQuantity`. Availability is not persisted or editable.

### `GET /inventory/movements?productId=<id>`

JWT required; `ADMIN`. Returns up to 200 newest inventory ledger entries. The optional product filter limits entries to one product.

### `POST /inventory/receipts`

JWT required; `ADMIN`. Adds physical stock inside a transaction and writes a `STOCK_RECEIPT` movement and audit entry.

```json
{ "productId": "cl…", "quantity": 20, "note": "Supplier GRN 554" }
```

Quantity must be a positive integer. Missing inventory is `404`; malformed input is `422`.

## Enquiries

### `GET /enquiries`

JWT required; any role. Lists enquiries with customer, creator, requested products, and status.

### `GET /enquiries/:id`

JWT required; any role. Returns one enquiry with items, or `404 NOT_FOUND`.

### `POST /enquiries`

JWT required; `ADMIN` or `SALES_USER`. Creates `NEW` enquiry and items transactionally, with an audit record.

```json
{
  "customerId": "cl…",
  "requiredDate": "2026-11-15",
  "notes": "Line expansion",
  "items": [{ "productId": "cl…", "quantity": 4 }, { "productId": "cl…", "quantity": 12 }]
}
```

Every requested product must exist, be unique within the request, and have positive quantity. An invalid customer/product returns `404`; invalid date/input returns `422`.

## Quotations

### `GET /quotations`

JWT required; any role. Lists quotations with lines, calculated totals, enquiry/customer, creator, and any converted sales order.

### `GET /quotations/:id`

JWT required; any role. Returns the same detail for one quotation or `404`.

### `POST /quotations`

JWT required; `ADMIN` or `SALES_USER`. Creates a `DRAFT`; price calculations are performed only by the backend.

```json
{
  "enquiryId": "cl…",
  "validUntil": "2026-11-01",
  "items": [
    { "productId": "cl…", "quantity": 2, "unitPrice": "48500.00", "discountPercent": "5", "gstPercent": "18" }
  ]
}
```

Returns `201` with calculated subtotal, discount, GST, grand total, and line fields. Products may occur only once; a lost enquiry cannot be quoted (`409 INVALID_STATE`).

### `PATCH /quotations/:id/status`

JWT required; `ADMIN` or `SALES_USER`. Body: `{ "status": "SENT" | "ACCEPTED" | "REJECTED" }`.

Allowed paths are `DRAFT → SENT`, then `SENT → ACCEPTED` or `SENT → REJECTED`. All other paths return `409 INVALID_STATE`. The quote row is locked during the change and the action is audited.

### `POST /quotations/:id/convert`

JWT required; `ADMIN` or `SALES_USER`. No body. Only an accepted quotation can be converted. It transactionally creates an order/items, marks the source enquiry `WON`, and adds an audit entry.

Returns `201`. Draft, sent, and rejected quotes return `409 INVALID_STATE`; replay returns `409 DUPLICATE_OPERATION`. The unique `sales_orders.quotation_id` is the database-level duplicate guard.

## Sales orders and dispatch

### `GET /sales-orders`

JWT required; any role. Lists orders, source quotation, customer, items, and one possible dispatch.

### `GET /sales-orders/:id`

JWT required; any role. Returns one order or `404`.

### `POST /sales-orders/:id/confirm`

JWT required; `ADMIN` only. No body. Only `PENDING` orders may be confirmed.

Within one serializable transaction the API locks the order and all inventory rows, validates availability, increments reserved stock, inserts `RESERVATION` movements, marks the order `CONFIRMED`, and writes audit events. Insufficient stock produces `409 INSUFFICIENT_STOCK`; a repeat produces `409 DUPLICATE_OPERATION`; cancelled/dispatched order produces `409 INVALID_STATE`.

### `POST /sales-orders/:id/dispatch`

JWT required; `ADMIN` only. Dispatch is a full-order shipment (one dispatch per order).

```json
{ "vehicleNumber": "MH12 AB 1234", "driverName": "Nikhil Patil", "dispatchDate": "2026-10-05" }
```

Within one serializable transaction the API locks the order and stock rows, checks each ordered quantity is reserved, creates the dispatch/dispatch items, decreases physical and reserved stock, creates `DISPATCH` movements, marks the order `DISPATCHED`, and audits. It returns `201`. Non-confirmed/cancelled orders are `409 INVALID_STATE`; repeat dispatch is `409 DUPLICATE_OPERATION`; an inconsistent/missing reservation is `409 INSUFFICIENT_STOCK`.

## Audit

### `GET /audit-logs`

JWT required; `ADMIN` only. Returns up to 200 newest significant business audit records with the acting user. It intentionally does not expose passwords, hashes, tokens, or GET-request noise.

## Health

### `GET /health`

Public. Returns `{ "success": true, "data": { "status": "ok" } }`. This is process health, not a replacement for a database readiness probe.

