import { prisma } from '../lib/prisma.js';

export function listProducts() {
  return prisma.product.findMany({ orderBy: { productCode: 'asc' } });
}

