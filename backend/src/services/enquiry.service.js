import { prisma } from '../lib/prisma.js';
import { businessNumber } from '../utils/business-number.js';
import { conflict, notFound } from '../utils/app-error.js';
import { audit } from './audit.service.js';
import { assertTransition } from './state-machine.service.js';

const include = {
  customer: true,
  createdBy: { select: { id: true, name: true, email: true } },
  items: { include: { product: true } },
};

export async function createEnquiry(data, userId) {
  const productIds = data.items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new Error('Duplicate products should have been caught by validation');
  }
  return prisma.$transaction(async (tx) => {
    const [customer, productCount] = await Promise.all([
      tx.customer.findUnique({ where: { id: data.customerId }, select: { id: true } }),
      tx.product.count({ where: { id: { in: productIds } } }),
    ]);
    if (!customer) throw notFound('Customer');
    if (productCount !== productIds.length) throw notFound('One or more products');
    const enquiry = await tx.enquiry.create({
      data: {
        enquiryNumber: businessNumber('ENQ'),
        customerId: data.customerId,
        enquiryDate: data.enquiryDate || new Date(),
        requiredDate: data.requiredDate,
        notes: data.notes || null,
        createdById: userId,
        items: { create: data.items },
      },
      include,
    });
    await audit(tx, { userId, action: 'CREATE_ENQUIRY', entityType: 'ENQUIRY', entityId: enquiry.id, metadata: { enquiryNumber: enquiry.enquiryNumber } });
    return enquiry;
  });
}

export function listEnquiries() {
  return prisma.enquiry.findMany({ include, orderBy: { createdAt: 'desc' } });
}

export async function getEnquiry(id) {
  const enquiry = await prisma.enquiry.findUnique({ where: { id }, include });
  if (!enquiry) throw notFound('Enquiry');
  return enquiry;
}

export async function markEnquiryLost(id, userId) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id", "status" FROM "enquiries" WHERE "id" = ${id} FOR UPDATE`;
    const enquiry = locked[0];
    if (!enquiry) throw notFound('Enquiry');
    assertTransition('enquiry', enquiry.status, 'LOST');

    const acceptedQuotes = await tx.quotation.count({ where: { enquiryId: id, status: 'ACCEPTED' } });
    if (acceptedQuotes > 0) {
      throw conflict('An enquiry with an accepted quotation cannot be marked lost.', 'INVALID_STATE');
    }

    const updated = await tx.enquiry.update({ where: { id }, data: { status: 'LOST' }, include });
    await audit(tx, { userId, action: 'MARK_ENQUIRY_LOST', entityType: 'ENQUIRY', entityId: id, metadata: { from: enquiry.status, to: 'LOST' } });
    return updated;
  });
}

