import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../utils/app-error.js';
import { audit } from './audit.service.js';

export function createCustomer(data) {
  return prisma.customer.create({ data });
}

export function listCustomers() {
  return prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
}

export async function deleteCustomer(id, userId) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows[0]) throw notFound('Customer');

    const [enquiries, quotations, orders] = await Promise.all([
      tx.enquiry.count({ where: { customerId: id } }),
      tx.quotation.count({ where: { customerId: id } }),
      tx.salesOrder.count({ where: { customerId: id } }),
    ]);
    if (enquiries || quotations || orders) {
      throw conflict('This customer has business history and cannot be deleted.', 'CUSTOMER_IN_USE');
    }

    await audit(tx, { userId, action: 'DELETE_CUSTOMER', entityType: 'CUSTOMER', entityId: id });
    return tx.customer.delete({ where: { id } });
  });
}

