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
  it('moves an enquiry to QUOTED when its first quotation is created', async () => {
    const enquiryResponse = await request(app).post('/api/enquiries').set('Authorization', `Bearer ${salesToken}`).send({
      customerId: customer.id,
      requiredDate: '2027-01-01',
      items: [{ productId: product.id, quantity: 2 }],
    });
    expect(enquiryResponse.status).toBe(201);
    expect(enquiryResponse.body.data.status).toBe('NEW');
    const quoteResponse = await request(app).post('/api/quotations').set('Authorization', `Bearer ${salesToken}`).send({
      enquiryId: enquiryResponse.body.data.id,
      validUntil: '2027-02-01',
      items: [{ productId: product.id, quantity: 2, unitPrice: '100.00', discountPercent: 0, gstPercent: 18 }],
    });
    expect(quoteResponse.status).toBe(201);
    expect((await prisma.enquiry.findUnique({ where: { id: enquiryResponse.body.data.id } })).status).toBe('QUOTED');
  });
  it('allows Sales to mark an open enquiry LOST but rejects later quotation creation', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'DRAFT' });
    const response = await request(app).patch(`/api/enquiries/${quote.enquiryId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'LOST' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('LOST');
    const quoteResponse = await request(app).post('/api/quotations').set('Authorization', `Bearer ${salesToken}`).send({
      enquiryId: quote.enquiryId,
      validUntil: '2027-02-01',
      items: [{ productId: product.id, quantity: 1, unitPrice: '100.00', discountPercent: 0, gstPercent: 18 }],
    });
    expect(quoteResponse.status).toBe(409);
    expect(quoteResponse.body.code).toBe('INVALID_STATE');
  });
  it('deletes an unused customer and preserves customers with enquiry history', async () => {
    const unused = await prisma.customer.create({ data: { companyName: 'Unused Company', contactPerson: 'Contact', mobile: '9999999998', email: 'unused@test.local', city: 'Pune' } });
    const deleted = await request(app).delete(`/api/customers/${unused.id}`).set('Authorization', `Bearer ${salesToken}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.customer.findUnique({ where: { id: unused.id } })).toBeNull();

    await orderFixture();
    const protectedCustomer = await request(app).delete(`/api/customers/${customer.id}`).set('Authorization', `Bearer ${salesToken}`);
    expect(protectedCustomer.status).toBe(409);
    expect(protectedCustomer.body.code).toBe('CUSTOMER_IN_USE');
  });
  it('rejects quotation products that were not requested in the enquiry', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'DRAFT' });
    const otherProduct = await prisma.product.create({ data: { productCode: 'TEST-OTHER', name: 'Other Pump', category: 'Test', unit: 'Nos', basePrice: '150.00' } });
    const response = await request(app).post('/api/quotations').set('Authorization', `Bearer ${salesToken}`).send({
      enquiryId: quote.enquiryId,
      validUntil: '2027-02-01',
      items: [{ productId: otherProduct.id, quantity: 1, unitPrice: '150.00', discountPercent: 0, gstPercent: 18 }],
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PRODUCT_NOT_IN_ENQUIRY');
  });
  it('allows admins to create a product with opening inventory and a stock ledger entry', async () => {
    const response = await request(app).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({
      productCode: 'NEW-001',
      name: 'New Industrial Valve',
      category: 'Valves',
      unit: 'Nos',
      basePrice: '2500.00',
      initialQuantity: 24,
    });
    expect(response.status).toBe(201);
    const created = await prisma.inventory.findUnique({ where: { productId: response.body.data.id } });
    expect(created.physicalQuantity).toBe(24);
    expect(created.reservedQuantity).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { productId: response.body.data.id, type: 'STOCK_RECEIPT' } })).toBe(1);
  });
  it('forbids sales users from creating catalog products', async () => {
    const response = await request(app).post('/api/products').set('Authorization', `Bearer ${salesToken}`).send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
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
    const cancellation = await request(app).post(`/api/sales-orders/${order.id}/cancel`).set('Authorization', `Bearer ${salesToken}`);
    expect(cancellation.status).toBe(403); expect(cancellation.body.code).toBe('FORBIDDEN');
  });
  it('forbids admins from creating customers, enquiries, or quotations and changing quotation workflow', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'DRAFT' });
    const headers = { Authorization: `Bearer ${adminToken}` };
    const responses = await Promise.all([
      request(app).post('/api/customers').set(headers).send({}),
      request(app).delete('/api/customers/unused-customer-id').set(headers),
      request(app).post('/api/enquiries').set(headers).send({}),
      request(app).post('/api/quotations').set(headers).send({}),
      request(app).patch(`/api/quotations/${quote.id}/status`).set(headers).send({ status: 'SENT' }),
      request(app).post(`/api/quotations/${quote.id}/convert`).set(headers),
    ]);
    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403, 403]);
    expect(responses.every((response) => response.body.code === 'FORBIDDEN')).toBe(true);
  });
  it('lets sales mark a quotation sent but only admin can accept or reject it', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'DRAFT' });
    const salesHeaders = { Authorization: `Bearer ${salesToken}` };
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const sent = await request(app).patch(`/api/quotations/${quote.id}/status`).set(salesHeaders).send({ status: 'SENT' });
    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe('SENT');

    const salesAccept = await request(app).patch(`/api/quotations/${quote.id}/status`).set(salesHeaders).send({ status: 'ACCEPTED' });
    expect(salesAccept.status).toBe(403);
    expect(salesAccept.body.code).toBe('FORBIDDEN');

    const salesReject = await request(app).patch(`/api/quotations/${quote.id}/status`).set(salesHeaders).send({ status: 'REJECTED' });
    expect(salesReject.status).toBe(403);
    expect(salesReject.body.code).toBe('FORBIDDEN');

    const accepted = await request(app).patch(`/api/quotations/${quote.id}/status`).set(adminHeaders).send({ status: 'ACCEPTED' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');
  });
  it('lets admin reject a sent quotation', async () => {
    const { quote } = await orderFixture({ quoteStatus: 'SENT' });
    const response = await request(app).patch(`/api/quotations/${quote.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'REJECTED' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('REJECTED');
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
  it('cancels a pending order without changing inventory', async () => {
    const { order } = await orderFixture({ quantity: 3, physical: 10, reserved: 0 });
    const response = await request(app).post(`/api/sales-orders/${order.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory.physicalQuantity).toBe(10);
    expect(inventory.reservedQuantity).toBe(0);
  });
  it('cancels a confirmed order and releases its reservation without reducing physical stock', async () => {
    const { order } = await orderFixture({ quantity: 3, physical: 10, reserved: 3, orderStatus: 'CONFIRMED' });
    const response = await request(app).post(`/api/sales-orders/${order.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory.physicalQuantity).toBe(10);
    expect(inventory.reservedQuantity).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id, type: 'RESERVATION_RELEASE', referenceId: order.id } })).toBe(1);
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
