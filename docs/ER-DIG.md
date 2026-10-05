# IndustrialFlow ER diagram

This diagram matches `backend/prisma/schema.prisma`, including the operational supporting tables `dispatch_items`, `inventory_movements`, and `audit_logs`.

```mermaid
erDiagram
  users {
    string id PK
    string email UK
    enum role
  }
  customers {
    string id PK
    string company_name
    string email
  }
  products {
    string id PK
    string product_code UK
    decimal base_price
  }
  inventory {
    string id PK
    string product_id UK, FK
    int physical_quantity
    int reserved_quantity
  }
  enquiries {
    string id PK
    string enquiry_number UK
    string customer_id FK
    string created_by_id FK
    enum status
  }
  enquiry_items {
    string id PK
    string enquiry_id FK
    string product_id FK
    int quantity
  }
  quotations {
    string id PK
    string quotation_number UK
    string enquiry_id FK
    string customer_id FK
    string created_by_id FK
    enum status
    decimal grand_total
  }
  quotation_items {
    string id PK
    string quotation_id FK
    string product_id FK
    int quantity
    decimal line_amount
  }
  sales_orders {
    string id PK
    string order_number UK
    string quotation_id UK, FK
    string customer_id FK
    enum status
  }
  sales_order_items {
    string id PK
    string sales_order_id FK
    string product_id FK
    int quantity
  }
  dispatches {
    string id PK
    string dispatch_number UK
    string sales_order_id UK, FK
  }
  dispatch_items {
    string id PK
    string dispatch_id FK
    string product_id FK
    int quantity
  }
  inventory_movements {
    string id PK
    string product_id FK
    string created_by_id FK
    enum type
    int quantity
    string reference_type
    string reference_id
  }
  audit_logs {
    string id PK
    string user_id FK
    string action
    string entity_type
    string entity_id
  }

  users ||--o{ enquiries : creates
  users ||--o{ quotations : creates
  users o|--o{ inventory_movements : performs
  users o|--o{ audit_logs : acts
  customers ||--o{ enquiries : raises
  customers ||--o{ quotations : receives
  customers ||--o{ sales_orders : orders
  products ||--o| inventory : has
  products ||--o{ enquiry_items : requested
  products ||--o{ quotation_items : priced
  products ||--o{ sales_order_items : ordered
  products ||--o{ dispatch_items : shipped
  products ||--o{ inventory_movements : moves
  enquiries ||--o{ enquiry_items : contains
  enquiries ||--o{ quotations : source
  quotations ||--o{ quotation_items : contains
  quotations ||--o| sales_orders : converts_to
  sales_orders ||--o{ sales_order_items : contains
  sales_orders ||--o| dispatches : fulfilled_by
  dispatches ||--o{ dispatch_items : contains
```

The unique quotation-to-order and order-to-dispatch relationships are important idempotency guarantees, not merely presentation choices.

