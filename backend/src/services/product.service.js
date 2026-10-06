import { prisma } from '../lib/prisma.js';
import { audit } from './audit.service.js';

export function createProduct({ initialQuantity, ...productData }, userId) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: productData });
    const inventory = await tx.inventory.create({
      data: { productId: product.id, physicalQuantity: initialQuantity, reservedQuantity: 0 },
    });
    if (initialQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'STOCK_RECEIPT',
          quantity: initialQuantity,
          referenceType: 'PRODUCT_CREATION',
          referenceId: inventory.id,
          createdById: userId,
        },
      });
    }
    await audit(tx, {
      userId,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      metadata: { productCode: product.productCode, initialQuantity },
    });
    return { ...product, inventory };
  });
}

export function listProducts() {
  return prisma.product.findMany({ orderBy: { productCode: 'asc' } });
}

