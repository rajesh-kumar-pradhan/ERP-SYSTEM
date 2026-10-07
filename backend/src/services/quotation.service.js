import { prisma } from '../lib/prisma.js';
import { businessNumber } from '../utils/business-number.js';
import { AppError, conflict, notFound } from '../utils/app-error.js';
import { audit } from './audit.service.js';
import { calculateQuotation } from './financial.service.js';
import { assertTransition } from './state-machine.service.js';
import { serializableTransaction } from '../utils/transaction.js';

const include = {
  customer: true,
  enquiry: { select: { id: true, enquiryNumber: true, status: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  items: { include: { product: true } },
  salesOrder: { select: { id: true, orderNumber: true, status: true } },
};

export async function createQuotation(data, userId) {
  const productIds = data.items.map((item) => item.productId);
  const calculation = calculateQuotation(data.items);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "enquiries" WHERE "id" = ${data.enquiryId} FOR UPDATE`;
    const [enquiry, productCount] = await Promise.all([
      tx.enquiry.findUnique({
        where: { id: data.enquiryId },
        select: { id: true, customerId: true, status: true, items: { select: { productId: true } } },
      }),
      tx.product.count({ where: { id: { in: productIds } } }),
    ]);
    if (!enquiry) throw notFound('Enquiry');
    if (!['NEW', 'QUOTED'].includes(enquiry.status)) throw conflict(`Cannot quote a ${enquiry.status.toLowerCase()} enquiry`, 'INVALID_STATE');
    if (productCount !== productIds.length) throw notFound('One or more products');
    const enquiryProductIds = new Set(enquiry.items.map((item) => item.productId));
    if (productIds.some((productId) => !enquiryProductIds.has(productId))) {
      throw conflict('Quotation products must be selected from the related enquiry.', 'PRODUCT_NOT_IN_ENQUIRY');
    }

    const quotation = await tx.quotation.create({
      data: {
        quotationNumber: businessNumber('QT'),
        enquiryId: data.enquiryId,
        customerId: enquiry.customerId,
        validUntil: data.validUntil,
        subtotal: calculation.subtotal,
        discountAmount: calculation.discountAmount,
        gstAmount: calculation.gstAmount,
        grandTotal: calculation.grandTotal,
        createdById: userId,
        items: { create: calculation.items.map(({ productId, quantity, unitPrice, discountPercent, gstPercent, baseAmount, discountAmount, taxableAmount, gstAmount, lineAmount }) => ({ productId, quantity, unitPrice, discountPercent, gstPercent, baseAmount, discountAmount, taxableAmount, gstAmount, lineAmount })) },
      },
      include,
    });
    if (enquiry.status === 'NEW') {
      await tx.enquiry.update({ where: { id: enquiry.id }, data: { status: 'QUOTED' } });
    }
    await audit(tx, { userId, action: 'CREATE_QUOTATION', entityType: 'QUOTATION', entityId: quotation.id, metadata: { quotationNumber: quotation.quotationNumber } });
    return quotation;
  });
}

export function listQuotations() {
  return prisma.quotation.findMany({ include, orderBy: { createdAt: 'desc' } });
}

export async function getQuotation(id) {
  const quotation = await prisma.quotation.findUnique({ where: { id }, include });
  if (!quotation) throw notFound('Quotation');
  return quotation;
}

export async function transitionQuotation(id, status, userId, role) {
  if (status === 'SENT' && role !== 'SALES_USER') {
    throw new AppError('You do not have permission for this operation', 403, 'FORBIDDEN');
  }
  if (['ACCEPTED', 'REJECTED'].includes(status) && role !== 'ADMIN') {
    throw new AppError('You do not have permission for this operation', 403, 'FORBIDDEN');
  }
  return prisma.$transaction(async (tx) => {
    // Lock makes a concurrent double-click observe the newly committed state.
    const locked = await tx.$queryRaw`SELECT "id", "status", "enquiry_id" FROM "quotations" WHERE "id" = ${id} FOR UPDATE`;
    const quotation = locked[0];
    if (!quotation) throw notFound('Quotation');
    assertTransition('quotation', quotation.status, status);
    if (status === 'ACCEPTED') {
      const enquiryRows = await tx.$queryRaw`SELECT "id", "status" FROM "enquiries" WHERE "id" = ${quotation.enquiry_id} FOR UPDATE`;
      if (!enquiryRows[0] || !['NEW', 'QUOTED'].includes(enquiryRows[0].status)) {
        throw conflict('Cannot accept a quotation for a closed enquiry', 'INVALID_STATE');
      }
    }
    const updated = await tx.quotation.update({ where: { id }, data: { status }, include });
    const actions = { SENT: 'SEND_QUOTATION', ACCEPTED: 'ACCEPT_QUOTATION', REJECTED: 'REJECT_QUOTATION' };
    await audit(tx, { userId, action: actions[status], entityType: 'QUOTATION', entityId: id, metadata: { from: quotation.status, to: status } });
    return updated;
  });
}

export async function convertQuotation(id, userId) {
  return serializableTransaction(prisma, async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id", "status", "customer_id", "enquiry_id", "grand_total" FROM "quotations" WHERE "id" = ${id} FOR UPDATE`;
    const quotation = locked[0];
    if (!quotation) throw notFound('Quotation');
    const existing = await tx.salesOrder.findUnique({ where: { quotationId: id }, select: { id: true } });
    if (existing) throw conflict('This quotation has already been converted', 'DUPLICATE_OPERATION');
    if (quotation.status !== 'ACCEPTED') throw conflict('Only an accepted quotation can be converted', 'INVALID_STATE');
    const enquiryRows = await tx.$queryRaw`SELECT "id", "status" FROM "enquiries" WHERE "id" = ${quotation.enquiry_id} FOR UPDATE`;
    if (!enquiryRows[0] || !['NEW', 'QUOTED'].includes(enquiryRows[0].status)) {
      throw conflict('Cannot convert a quotation for a closed enquiry', 'INVALID_STATE');
    }
    assertTransition('enquiry', enquiryRows[0].status, 'WON');

    const quoteItems = await tx.quotationItem.findMany({ where: { quotationId: id } });
    const order = await tx.salesOrder.create({
      data: {
        orderNumber: businessNumber('SO'),
        customerId: quotation.customer_id,
        quotationId: id,
        totalAmount: quotation.grand_total,
        items: { create: quoteItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, lineAmount: item.lineAmount })) },
      },
      include: { customer: true, quotation: true, items: { include: { product: true } } },
    });
    await tx.enquiry.update({ where: { id: quotation.enquiry_id }, data: { status: 'WON' } });
    await audit(tx, { userId, action: 'CONVERT_QUOTATION', entityType: 'SALES_ORDER', entityId: order.id, metadata: { quotationId: id, orderNumber: order.orderNumber } });
    return order;
  });
}
