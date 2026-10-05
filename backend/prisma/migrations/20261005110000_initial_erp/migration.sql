-- IndustrialFlow's schema deliberately keeps stock balances, movements, and business
-- documents separate. The check constraints below are database-enforced invariants.

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES_USER');
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'QUOTED', 'WON', 'LOST');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');
CREATE TYPE "SalesOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED');
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_RECEIPT', 'RESERVATION', 'RESERVATION_RELEASE', 'DISPATCH', 'ADJUSTMENT');

CREATE TABLE "users" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL, "role" "UserRole" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "customers" (
  "id" TEXT NOT NULL, "company_name" TEXT NOT NULL, "contact_person" TEXT NOT NULL,
  "mobile" TEXT NOT NULL, "email" TEXT NOT NULL, "city" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customers_company_name_idx" ON "customers"("company_name");

CREATE TABLE "products" (
  "id" TEXT NOT NULL, "product_code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "category" TEXT NOT NULL, "unit" TEXT NOT NULL, "base_price" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_base_price_nonnegative" CHECK ("base_price" >= 0)
);
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

CREATE TABLE "inventory" (
  "id" TEXT NOT NULL, "product_id" TEXT NOT NULL, "physical_quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_nonnegative" CHECK ("physical_quantity" >= 0 AND "reserved_quantity" >= 0 AND "reserved_quantity" <= "physical_quantity")
);
CREATE UNIQUE INDEX "inventory_product_id_key" ON "inventory"("product_id");

CREATE TABLE "enquiries" (
  "id" TEXT NOT NULL, "enquiry_number" TEXT NOT NULL, "customer_id" TEXT NOT NULL,
  "enquiry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "required_date" TIMESTAMP(3) NOT NULL,
  "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW', "notes" TEXT,
  "created_by_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "enquiries_enquiry_number_key" ON "enquiries"("enquiry_number");
CREATE INDEX "enquiries_customer_id_created_at_idx" ON "enquiries"("customer_id", "created_at");
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

CREATE TABLE "enquiry_items" (
  "id" TEXT NOT NULL, "enquiry_id" TEXT NOT NULL, "product_id" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  CONSTRAINT "enquiry_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enquiry_items_quantity_positive" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "enquiry_items_enquiry_id_product_id_key" ON "enquiry_items"("enquiry_id", "product_id");

CREATE TABLE "quotations" (
  "id" TEXT NOT NULL, "quotation_number" TEXT NOT NULL, "enquiry_id" TEXT NOT NULL, "customer_id" TEXT NOT NULL,
  "valid_until" TIMESTAMP(3) NOT NULL, "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(14,2) NOT NULL, "discount_amount" DECIMAL(14,2) NOT NULL,
  "gst_amount" DECIMAL(14,2) NOT NULL, "grand_total" DECIMAL(14,2) NOT NULL,
  "created_by_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quotations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotations_totals_nonnegative" CHECK ("subtotal" >= 0 AND "discount_amount" >= 0 AND "gst_amount" >= 0 AND "grand_total" >= 0)
);
CREATE UNIQUE INDEX "quotations_quotation_number_key" ON "quotations"("quotation_number");
CREATE INDEX "quotations_customer_id_created_at_idx" ON "quotations"("customer_id", "created_at");
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

CREATE TABLE "quotation_items" (
  "id" TEXT NOT NULL, "quotation_id" TEXT NOT NULL, "product_id" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL, "discount_percent" DECIMAL(5,2) NOT NULL,
  "gst_percent" DECIMAL(5,2) NOT NULL, "base_amount" DECIMAL(14,2) NOT NULL,
  "discount_amount" DECIMAL(14,2) NOT NULL, "taxable_amount" DECIMAL(14,2) NOT NULL,
  "gst_amount" DECIMAL(14,2) NOT NULL, "line_amount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotation_items_values_valid" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_percent" >= 0 AND "discount_percent" <= 100 AND "gst_percent" >= 0 AND "gst_percent" <= 100)
);
CREATE UNIQUE INDEX "quotation_items_quotation_id_product_id_key" ON "quotation_items"("quotation_id", "product_id");

CREATE TABLE "sales_orders" (
  "id" TEXT NOT NULL, "order_number" TEXT NOT NULL, "customer_id" TEXT NOT NULL, "quotation_id" TEXT NOT NULL,
  "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "total_amount" DECIMAL(14,2) NOT NULL,
  "status" "SalesOrderStatus" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_orders_total_nonnegative" CHECK ("total_amount" >= 0)
);
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");
CREATE UNIQUE INDEX "sales_orders_quotation_id_key" ON "sales_orders"("quotation_id");
CREATE INDEX "sales_orders_customer_id_created_at_idx" ON "sales_orders"("customer_id", "created_at");
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

CREATE TABLE "sales_order_items" (
  "id" TEXT NOT NULL, "sales_order_id" TEXT NOT NULL, "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "unit_price" DECIMAL(14,2) NOT NULL, "line_amount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_order_items_values_valid" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "line_amount" >= 0)
);
CREATE UNIQUE INDEX "sales_order_items_sales_order_id_product_id_key" ON "sales_order_items"("sales_order_id", "product_id");

CREATE TABLE "dispatches" (
  "id" TEXT NOT NULL, "dispatch_number" TEXT NOT NULL, "sales_order_id" TEXT NOT NULL,
  "dispatch_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "vehicle_number" TEXT NOT NULL,
  "driver_name" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dispatches_dispatch_number_key" ON "dispatches"("dispatch_number");
CREATE UNIQUE INDEX "dispatches_sales_order_id_key" ON "dispatches"("sales_order_id");

CREATE TABLE "dispatch_items" (
  "id" TEXT NOT NULL, "dispatch_id" TEXT NOT NULL, "product_id" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  CONSTRAINT "dispatch_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dispatch_items_quantity_positive" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "dispatch_items_dispatch_id_product_id_key" ON "dispatch_items"("dispatch_id", "product_id");

CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL, "product_id" TEXT NOT NULL, "type" "InventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL, "reference_type" TEXT NOT NULL, "reference_id" TEXT NOT NULL,
  "created_by_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_movements_quantity_positive" CHECK ("quantity" > 0)
);
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");
CREATE INDEX "inventory_movements_reference_type_reference_id_idx" ON "inventory_movements"("reference_type", "reference_id");

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL, "user_id" TEXT, "action" TEXT NOT NULL, "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL, "metadata" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
