import { prisma } from '../lib/prisma.js';

export function createCustomer(data) {
  return prisma.customer.create({ data });
}

export function listCustomers() {
  return prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
}

