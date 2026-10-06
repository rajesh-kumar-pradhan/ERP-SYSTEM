import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../utils/app-error.js';
import { audit } from './audit.service.js';
import { serializableTransaction } from '../utils/transaction.js';
import { assertTransition } from './state-machine.service.js';

const inventoryInclude = { product: true };

export async function listInventory() {
  const rows = await prisma.inventory.findMany({ include: inventoryInclude, orderBy: { product: { productCode: 'asc' } } });
  return rows.map((row) => ({ ...row, availableQuantity: row.physicalQuantity - row.reservedQuantity }));
}

export function listMovements(productId) {
  return prisma.inventoryMovement.findMany({
    where: productId ? { productId } : undefined,
    include: { product: { select: { productCode: true, name: true, unit: true } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function receiveStock({ productId, quantity, note }, userId) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id", "physical_quantity", "reserved_quantity" FROM "inventory" WHERE "product_id" = ${productId} FOR UPDATE`;
    if (!locked[0]) throw notFound('Inventory record');
    const inventory = await tx.inventory.update({
      where: { productId },
      data: { physicalQuantity: { increment: quantity } },
      include: inventoryInclude,
    });
    await tx.inventoryMovement.create({ data: { productId, type: 'STOCK_RECEIPT', quantity, referenceType: 'STOCK_RECEIPT', referenceId: inventory.id, createdById: userId } });
    await audit(tx, { userId, action: 'RECEIVE_STOCK', entityType: 'INVENTORY', entityId: inventory.id, metadata: { productId, quantity, note: note || null } });
    return { ...inventory, availableQuantity: inventory.physicalQuantity - inventory.reservedQuantity };
  });
}

/** Locks every relevant stock row in sorted product-id order. PostgreSQL holds these
 * row locks to the transaction end, so another confirmation waits and recalculates
 * availability after the first reservation commits rather than using a stale read. */
async function lockInventoryRows(tx, productIds) {
  const ids = [...productIds].sort();
  return tx.$queryRaw`SELECT "id", "product_id", "physical_quantity", "reserved_quantity" FROM "inventory" WHERE "product_id" IN (${Prisma.join(ids)}) ORDER BY "product_id" FOR UPDATE`;
}

async function lockOrder(tx, orderId) {
  const rows = await tx.$queryRaw`SELECT "id", "status" FROM "sales_orders" WHERE "id" = ${orderId} FOR UPDATE`;
  return rows[0];
}

export async function confirmSalesOrder(orderId, userId) {
  return serializableTransaction(prisma, async (tx) => {
    const lockedOrder = await lockOrder(tx, orderId);
    if (!lockedOrder) throw notFound('Sales order');
    if (lockedOrder.status === 'CONFIRMED') throw conflict('Inventory is already reserved for this order', 'DUPLICATE_OPERATION');
    if (lockedOrder.status !== 'PENDING') throw conflict(`Cannot confirm a ${lockedOrder.status} sales order`, 'INVALID_STATE');

    const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    const inventoryRows = await lockInventoryRows(tx, order.items.map((item) => item.productId));
    if (inventoryRows.length !== order.items.length) throw notFound('Inventory record for one or more products');
    const inventoryByProduct = new Map(inventoryRows.map((row) => [row.product_id, row]));
    for (const item of order.items) {
      const row = inventoryByProduct.get(item.productId);
      const available = row.physical_quantity - row.reserved_quantity;
      if (available < item.quantity) {
        throw conflict(`Insufficient inventory for product ${item.productId}: ${available} available, ${item.quantity} requested`, 'INSUFFICIENT_STOCK');
      }
    }

    for (const item of order.items) {
      await tx.inventory.update({ where: { productId: item.productId }, data: { reservedQuantity: { increment: item.quantity } } });
      await tx.inventoryMovement.create({ data: { productId: item.productId, type: 'RESERVATION', quantity: item.quantity, referenceType: 'SALES_ORDER', referenceId: orderId, createdById: userId } });
    }
    const confirmed = await tx.salesOrder.update({ where: { id: orderId }, data: { status: 'CONFIRMED' }, include: salesOrderInclude });
    await audit(tx, { userId, action: 'RESERVE_INVENTORY', entityType: 'SALES_ORDER', entityId: orderId, metadata: { itemCount: order.items.length } });
    await audit(tx, { userId, action: 'CONFIRM_SALES_ORDER', entityType: 'SALES_ORDER', entityId: orderId, metadata: { status: 'CONFIRMED' } });
    return confirmed;
  });
}

export async function cancelSalesOrder(orderId, userId) {
  return serializableTransaction(prisma, async (tx) => {
    const lockedOrder = await lockOrder(tx, orderId);
    if (!lockedOrder) throw notFound('Sales order');
    if (lockedOrder.status === 'CANCELLED') throw conflict('Sales order is already cancelled', 'DUPLICATE_OPERATION');
    assertTransition('salesOrder', lockedOrder.status, 'CANCELLED');

    const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (lockedOrder.status === 'CONFIRMED') {
      const inventoryRows = await lockInventoryRows(tx, order.items.map((item) => item.productId));
      if (inventoryRows.length !== order.items.length) throw notFound('Inventory record for one or more products');
      const inventoryByProduct = new Map(inventoryRows.map((row) => [row.product_id, row]));
      for (const item of order.items) {
        const row = inventoryByProduct.get(item.productId);
        if (row.reserved_quantity < item.quantity) {
          throw conflict(`Reserved inventory is insufficient to cancel product ${item.productId}`, 'INSUFFICIENT_STOCK');
        }
      }

      for (const item of order.items) {
        await tx.inventory.update({ where: { productId: item.productId }, data: { reservedQuantity: { decrement: item.quantity } } });
        await tx.inventoryMovement.create({
          data: { productId: item.productId, type: 'RESERVATION_RELEASE', quantity: item.quantity, referenceType: 'SALES_ORDER_CANCEL', referenceId: orderId, createdById: userId },
        });
      }
    }

    const cancelled = await tx.salesOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED' }, include: salesOrderInclude });
    await audit(tx, {
      userId,
      action: 'CANCEL_SALES_ORDER',
      entityType: 'SALES_ORDER',
      entityId: orderId,
      metadata: { from: lockedOrder.status, to: 'CANCELLED', releasedReservations: lockedOrder.status === 'CONFIRMED' },
    });
    return cancelled;
  });
}

export const salesOrderInclude = {
  customer: true,
  quotation: { select: { id: true, quotationNumber: true } },
  items: { include: { product: true } },
  dispatch: { include: { items: { include: { product: true } } } },
};
