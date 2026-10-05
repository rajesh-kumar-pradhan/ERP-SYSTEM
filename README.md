# IndustrialFlow

IndustrialFlow is a deliberately focused PERN ERP for a manufacturing and supply business. It demonstrates a traceable order lifecycle rather than broad, shallow CRUD:

`Customer → Enquiry → Quotation → Accepted quotation → Sales order → Reservation → Confirmed order → Dispatch`

The project is designed for discussion in a full-stack evaluation: PostgreSQL owns critical data invariants, server-side services own business rules, and the React UI is a practical client of that API.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `frontend/` | Vite + React workflow UI, React Router, centralized Axios/JWT client |
| `backend/src/routes` | Endpoint mapping and access middleware |
| `backend/src/controllers` | HTTP request/response translation only |
| `backend/src/services` | Financial calculations, state transitions, transactional operations |
| `backend/prisma` | PostgreSQL schema, migration, idempotent seed |

Important application layers are intentionally few. For example, quotation math belongs in `financial.service.js`, while state transition policy belongs in `state-machine.service.js`; neither is duplicated in React or controllers.

## Project layout

```text
.
├── backend/
│   ├── prisma/                 # schema, deployable migration, seed data
│   ├── src/{config,controllers,lib,middleware,routes,services,utils,validators}/
│   └── tests/                  # unit tests + opt-in real DB integration tests
├── frontend/src/{api,auth,components,pages}/
├── docs/{API.md,ER-DIG.md}
└── postman/IndustrialFlow.postman_collection.json
```

## Database and business design

The full entity graph is in [docs/ER-DIG.md](docs/ER-DIG.md). Core records are normalized: users, customers, products, inventory, enquiries/items, quotations/items, sales orders/items, dispatches/items, inventory movements, and audit logs.

PostgreSQL constraints are part of the design, not a fallback:

- Unique business identifiers: product code, enquiry number, quotation number, order number, dispatch number.
- One inventory row per product, one sales order per quotation, and one dispatch per order.
- Foreign keys with appropriate `RESTRICT`, `CASCADE`, and `SET NULL` behavior.
- Checks for positive line quantities, non-negative pricing/totals, percentages from 0–100, and `0 ≤ reserved_quantity ≤ physical_quantity`.
- Indexes for status/customer timelines, product movement history, references, and audit lookup.

### Quotation finance

The browser submits item inputs, never an authoritative total. The backend uses Prisma `Decimal` and rounds stored monetary amounts to two decimals (`ROUND_HALF_UP`):

```text
base     = quantity × unit price
discount = base × discount % / 100
taxable  = base - discount
GST      = taxable × GST % / 100
line     = taxable + GST
total    = sum(line)
```

It retains each calculation component on the quotation item so a historical quote remains explainable even if product base prices change later.

### State and idempotency

- Quotation: `DRAFT → SENT → ACCEPTED | REJECTED`.
- Sales order: `PENDING → CONFIRMED → DISPATCHED`; `PENDING → CANCELLED` is intentionally represented as an explicit future-safe transition, but no cancellation endpoint is exposed yet.
- Conversion locks the quotation and has both a service check and a database-unique `quotation_id`. A repeated request returns `DUPLICATE_OPERATION` and cannot create a second order.
- Confirmation locks the order; a repeated confirmation returns `DUPLICATE_OPERATION`.
- Dispatch locks the order and has a unique `dispatch.sales_order_id`; a repeated request returns `DUPLICATE_OPERATION`.

### Inventory, movements, and concurrency

Availability is derived, never stored: `physicalQuantity - reservedQuantity`.

Confirming an order runs in a PostgreSQL serializable transaction. It locks the order and all involved inventory rows with `SELECT … FOR UPDATE`, in sorted product-ID order. A concurrent confirmation requiring the same stock waits on the row lock; after the first commits, the second reads the current reserved balance and fails cleanly if insufficient. PostgreSQL can instead issue its valid serializable-retry signal (`40001`); the service retries the complete transaction up to three times before it ever reaches the client. It cannot produce an invalid `reserved > physical` state; the database check constraint remains a final guard.

Reservation creates `RESERVATION` movement rows but does not change physical stock. Dispatch creates one `DISPATCH` movement per order item and atomically decrements both physical and reserved stock. Admin stock receipts create `STOCK_RECEIPT` movements. The ledger records product, type, quantity, business reference, actor, and timestamp, so there are no artificial “available stock” edits to explain.

`audit_logs` records important events only: login, enquiry/quotation creation, quotation status actions, conversion, receipt, reservation/confirmation, and dispatch. It never stores a password, password hash, or JWT.

## Setup

Prerequisites: Node 22+, npm 10+, PostgreSQL 18+.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env with the real local PostgreSQL password and a long JWT secret
npm install
npm run prisma:generate
npm run prisma:migrate --workspace=backend -- --name initial_erp
# Or, when using the committed migration on a clean/managed database:
npm run prisma:deploy --workspace=backend
npm run prisma:seed
npm run dev:backend
npm run dev:frontend
```

The default endpoints are API `http://localhost:4000` and UI `http://localhost:5173`. `DATABASE_URL` exists only in `backend/.env`; it is never used by the Vite client.

For this local database, set:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5432/erp_system?schema=public"
JWT_SECRET="a-long-random-secret-at-least-32-characters"
```

Use `prisma migrate deploy` for a production-like/CI deployment. `prisma migrate dev` is for local migration authoring. The migration does not drop or reset a database.

## Seed credentials

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@industrialflow.local` | `IndustrialFlow@123` |
| SALES_USER | `sales@industrialflow.local` | `IndustrialFlow@123` |

The seed is idempotent and creates the two accounts, six industrial products with inventory, three customers, and a draft demo enquiry/quotation. Replace the demonstration password in a real deployment.

## Testing

```bash
# Always-safe unit tests (financial calculation and state policy)
npm test

# Full integration suite against a separately migrated test DB only
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/industrialflow_test?schema=public" npm test
```

The integration suite never falls back to `erp_system`; it is skipped unless `TEST_DATABASE_URL` is supplied. After creating and migrating `industrialflow_test`, it verifies: invalid draft/rejected conversion, duplicate conversion, insufficient inventory, ADMIN RBAC, dispatch stock checks, atomic dispatch decrement, and movement creation. This avoids any accidental test reset of development data.

## API, UI, and Postman

- API details and error rules: [docs/API.md](docs/API.md)
- Mermaid ER diagram: [docs/ER-DIG.md](docs/ER-DIG.md)
- Import [postman/IndustrialFlow.postman_collection.json](postman/IndustrialFlow.postman_collection.json) and set `baseUrl`; the Login request stores `token` automatically.

The UI intentionally has only the workflow screens: Login, Enquiries (including customer creation), Quotations, Sales Orders, and Inventory. Navigation and buttons adapt to role for usability; the backend independently enforces every restricted action.

## Assumptions and trade-offs

- Each order is dispatched in full once. This keeps the required `CONFIRMED → DISPATCHED` workflow clear; `dispatch_items` is already modeled so partial deliveries can be introduced later without denormalizing data.
- Cancellation is declared in the order state policy but withheld from the UI/API until the release workflow is specified. A future confirmed-order cancellation should be one transaction: lock inventory, decrement reserved, add `RESERVATION_RELEASE` movements, set `CANCELLED`, and audit the event.
- Damaged stock is not modeled prematurely. Adding `damaged_quantity` and extending the availability calculation to `physical - reserved - damaged`, plus a movement type, does not require rewriting documents, audit, or reservation logic.
- Document numbers are timestamp/entropy strings and protected by unique constraints. They are suitable for the evaluation; a future legal numbering sequence can be added as a small database-backed allocator.

## Verification notes

`npm run build` builds both backend (Prisma client generation) and frontend. Backend startup validates `DATABASE_URL` and `JWT_SECRET` rather than silently running with unsafe configuration. The API returns a stable failure envelope such as `{ "success": false, "message": "Insufficient inventory", "code": "INSUFFICIENT_STOCK" }` and never returns stack traces to clients.

## Git

Suggested meaningful commits for this implementation are listed in the evaluation brief. This workspace was supplied without an initialized writable Git metadata directory, so no commits could be created here; application files are ready to be committed once Git is initialized in the developer’s normal repository.
