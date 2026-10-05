import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/app-error.js';
import { salesOrderInclude } from './inventory.service.js';

export function listSalesOrders() {
  return prisma.salesOrder.findMany({ include: salesOrderInclude, orderBy: { createdAt: 'desc' } });
}

export async function getSalesOrder(id) {
  const order = await prisma.salesOrder.findUnique({ where: { id }, include: salesOrderInclude });
  if (!order) throw notFound('Sales order');
  return order;
}

