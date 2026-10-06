import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// These are real API/database tests. They deliberately require a separate database:
// TEST_DATABASE_URL=.../industrialflow_test npm test. They never reset erp_system.
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
let prisma; let app; let adminToken; let salesToken; let admin; let sales; let customer; let product;

describeDatabase('ERP workflow integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'integration-test-secret-only';
    ({ prisma } = await import('../src/lib/prisma.js'));
    ({ default: app } = await import('../src/app.js'));
  });
  beforeEach(async () => {
    await prisma.auditLog.deleteMany(); await prisma.inventoryMovement.deleteMany(); await prisma.dispatchItem.deleteMany(); await prisma.dispatch.deleteMany(); await prisma.salesOrderItem.deleteMany(); await prisma.salesOrder.deleteMany(); await prisma.quotationItem.deleteMany(); await prisma.quotation.deleteMany(); await prisma.enquiryItem.deleteMany(); await prisma.enquiry.deleteMany(); await prisma.inventory.deleteMany(); await prisma.product.deleteMany(); await prisma.customer.deleteMany(); await prisma.user.deleteMany();
    const hash = await bcrypt.hash('IndustrialFlow@123', 4);
    admin = await prisma.user.create({ data: { name: 'Admin', email: 'admin@test.local', passwordHash: hash, role: 'ADMIN' } });
    sales = await prisma.user.create({ data: { name: 'Sales', email: 'sales@test.local', passwordHash: hash, role: 'SALES_USER' } });
    customer = await prisma.customer.create({ data: { companyName: 'Test Fabrication', contactPerson: 'Person', mobile: '9999999999', email: 'customer@test.local', city: 'Pune' } });
    product = await prisma.product.create({ data: { productCode: 'TEST-001', name: 'Test Pump', category: 'Test', unit: 'Nos', basePrice: '100.00' } });
    await prisma.inventory.create({ data: { productId: product.id, physicalQuantity: 10, reservedQuantity: 0 } });
    adminToken = (await request(app).post('/api/auth/login').send({ email: admin.email, password: 'IndustrialFlow@123' })).body.data.token;
    salesToken = (await request(app).post('/api/auth/login').send({ email: sales.email, password: 'IndustrialFlow@123' })).body.data.token;
  });
  afterAll(async () => prisma?.$disconnect());

  async function orderFixture({ quoteStatus = 'ACCEPTED', quantity = 3, physical = 10, reserved = 0, orderStatus = 'PENDING' } = {}) {
    await prisma.inventory.update({ where: { productId: product.id }, data: { physicalQuantity: physical, reservedQuantity: reserved } });
    const enquiry = await prisma.enquiry.create({ data: { enquiryNumber: `ENQ-${Date.now()}-${Math.random()}`, customerId: customer.id, requiredDate: new Date('2027-01-01'), createdById: sales.id, items: { create: { productId: product.id, quantity } } } });
    const quote = await prisma.quotation.create({ data: { quotationNumber: `QT-${Date.now()}-${Math.random()}`, enquiryId: enquiry.id, customerId: customer.id, validUntil: new Date('2027-01-01'), status: quoteStatus, subtotal: '100.00', discountAmount: '0.00', gstAmount: '18.00', grandTotal: '118.00', createdById: sales.id, items: { create: { productId: product.id, quantity, unitPrice: '100.00', discountPercent: '0.00', gstPercent: '18.00', baseAmount: '100.00', discountAmount: '0.00', taxableAmount: '100.00', gstAmount: '18.00', lineAmount: '118.00' } } } });
    if (quoteStatus !== 'ACCEPTED') return { quote };
    const order = await prisma.salesOrder.create({ data: { orderNumber: `SO-${Date.now()}-${Math.random()}`, customerId: customer.id, quotationId: quote.id, totalAmount: '118.00', status: orderStatus, items: { create: { productId: product.id, quantity, unitPrice: '100.00', lineAmount: '118.00' } } } });
    return { quote, order };
  }

  it('rejects conversion of a DRAFT quotation', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'DRAFT' });
    const response = await request(app).post(`/api/quotations/${quote.id}/convert`).set('Authorization', `Bearer ${salesToken}`);
    expect(response.status).toBe(409); expect(response.body.code).toBe('INVALID_STATE');
  });
  it('rejects conversion of a REJECTED quotation', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'REJECTED' });
    const response = await request(app).post(`/api/quotations/${quote.id}/convert`).set('Authorization', `Bearer ${salesToken}`);
    expect(response.status).toBe(409); expect(response.body.code).toBe('INVALID_STATE');
  });
  it('prevents duplicate quotation conversion', async () => {
    const enquiry = await prisma.enquiry.create({ data: { enquiryNumber: 'ENQ-CONVERT', customerId: customer.id, requiredDate: new Date('2027-01-01'), createdById: sales.id, items: { create: { productId: product.id, quantity: 1 } } } });
    const quote = await prisma.quotation.create({ data: { quotationNumber: 'QT-CONVERT', enquiryId: enquiry.id, customerId: customer.id, validUntil: new Date('2027-01-01'), status: 'ACCEPTED', subtotal: '100', discountAmount: '0', gstAmount: '18', grandTotal: '118', createdById: sales.id, items: { create: { productId: product.id, quantity: 1, unitPrice: '100', discountPercent: '0', gstPercent: '18', baseAmount: '100', discountAmount: '0', taxableAmount: '100', gstAmount: '18', lineAmount: '118' } } } });
    expect((await request(app).post(`/api/quotations/${quote.id}/convert`).set('Authorization', `Bearer ${salesToken}`)).status).toBe(201);
    const repeated = await request(app).post(`/api/quotations/${quote.id}/convert`).set('Authorization', `Bearer ${salesToken}`);
    expect(repeated.status).toBe(409); expect(repeated.body.code).toBe('DUPLICATE_OPERATION');
  });
  it('prevents insufficient inventory and leaves the order pending', async () => {
    const { order } = await orderFixture({ quantity: 11, physical: 10 });
    const response = await request(app).post(`/api/sales-orders/${order.id}/confirm`).set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(409); expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect((await prisma.salesOrder.findUnique({ where: { id: order.id } })).status).toBe('PENDING');
  });
  it('forbids a sales user from confirming an order', async () => {
    const { order } = await orderFixture();
    const response = await request(app).post(`/api/sales-orders/${order.id}/confirm`).set('Authorization', `Bearer ${salesToken}`);
    expect(response.status).toBe(403); expect(response.body.code).toBe('FORBIDDEN');
  });
  it.each([[80, 50], [70, 80]])('serializes concurrent reservations so %i and %i cannot oversubscribe 100', async (firstQuantity, secondQuantity) => {
    const first = await orderFixture({ quantity: firstQuantity, physical: 100 });
    const second = await orderFixture({ quantity: secondQuantity, physical: 100 });
    const responses = await Promise.all([
      request(app).post(`/api/sales-orders/${first.order.id}/confirm`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/sales-orders/${second.order.id}/confirm`).set('Authorization', `Bearer ${adminToken}`),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409 && response.body.code === 'INSUFFICIENT_STOCK')).toHaveLength(1);
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBeLessThanOrEqual(inventory.physicalQuantity);
    expect([firstQuantity, secondQuantity]).toContain(inventory.reservedQuantity);
  });
  it('allows concurrent reservations when their combined quantity fits available stock', async () => {
    const first = await orderFixture({ quantity: 30, physical: 100 });
    const second = await orderFixture({ quantity: 40, physical: 100 });
    const responses = await Promise.all([
      request(app).post(`/api/sales-orders/${first.order.id}/confirm`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/sales-orders/${second.order.id}/confirm`).set('Authorization', `Bearer ${adminToken}`),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBe(70);
  });
  it('prevents dispatch beyond the reserved quantity', async () => {
    const { order } = await orderFixture({ quantity: 3, physical: 10, reserved: 2, orderStatus: 'CONFIRMED' });
    const response = await request(app).post(`/api/sales-orders/${order.id}/dispatch`).set('Authorization', `Bearer ${adminToken}`).send({ vehicleNumber: 'MH12 AB 1234', driverName: 'Nikhil' });
    expect(response.status).toBe(409); expect(response.body.code).toBe('INSUFFICIENT_STOCK');
  });
  it('dispatches atomically and reduces physical and reserved stock', async () => {
    const { order } = await orderFixture({ quantity: 3, physical: 10, reserved: 3, orderStatus: 'CONFIRMED' });
    const response = await request(app).post(`/api/sales-orders/${order.id}/dispatch`).set('Authorization', `Bearer ${adminToken}`).send({ vehicleNumber: 'MH12 AB 1234', driverName: 'Nikhil' });
    expect(response.status).toBe(201);
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory.physicalQuantity).toBe(7); expect(inventory.reservedQuantity).toBe(0);
    expect((await prisma.salesOrder.findUnique({ where: { id: order.id } })).status).toBe('DISPATCHED');
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id, type: 'DISPATCH' } })).toBe(1);
  });
});
