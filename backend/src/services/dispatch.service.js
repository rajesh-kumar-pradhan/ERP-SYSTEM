import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { businessNumber } from '../utils/business-number.js';
import { conflict, notFound } from '../utils/app-error.js';
import { audit } from './audit.service.js';
import { salesOrderInclude } from './inventory.service.js';
import { serializableTransaction } from '../utils/transaction.js';

async function lockInventoryRows(tx, productIds) {
  const ids = [...productIds].sort();
  return tx.$queryRaw`SELECT "id", "product_id", "physical_quantity", "reserved_quantity" FROM "inventory" WHERE "product_id" IN (${Prisma.join(ids)}) ORDER BY "product_id" FOR UPDATE`;
}

export async function dispatchSalesOrder(orderId, data, userId) {
  return serializableTransaction(prisma, async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id", "status" FROM "sales_orders" WHERE "id" = ${orderId} FOR UPDATE`;
    const lockedOrder = locked[0];
    if (!lockedOrder) throw notFound('Sales order');
    if (lockedOrder.status === 'DISPATCHED') throw conflict('This order has already been dispatched', 'DUPLICATE_OPERATION');
    if (lockedOrder.status !== 'CONFIRMED') throw conflict('Only a confirmed sales order can be dispatched', 'INVALID_STATE');
    const existingDispatch = await tx.dispatch.findUnique({ where: { salesOrderId: orderId }, select: { id: true } });
    if (existingDispatch) throw conflict('This order already has a dispatch', 'DUPLICATE_OPERATION');

    const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    const inventoryRows = await lockInventoryRows(tx, order.items.map((item) => item.productId));
    if (inventoryRows.length !== order.items.length) throw notFound('Inventory record for one or more products');
    const inventoryByProduct = new Map(inventoryRows.map((row) => [row.product_id, row]));
    for (const item of order.items) {
      const row = inventoryByProduct.get(item.productId);
      if (row.reserved_quantity < item.quantity || row.physical_quantity < item.quantity) {
        throw conflict(`Reserved inventory is insufficient to dispatch product ${item.productId}`, 'INSUFFICIENT_STOCK');
      }
    }

    const dispatch = await tx.dispatch.create({
      data: {
        dispatchNumber: businessNumber('DSP'),
        salesOrderId: orderId,
        dispatchDate: data.dispatchDate || new Date(),
        vehicleNumber: data.vehicleNumber,
        driverName: data.driverName,
        items: { create: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
      },
      include: { items: { include: { product: true } } },
    });
    for (const item of order.items) {
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { physicalQuantity: { decrement: item.quantity }, reservedQuantity: { decrement: item.quantity } },
      });
      await tx.inventoryMovement.create({ data: { productId: item.productId, type: 'DISPATCH', quantity: item.quantity, referenceType: 'DISPATCH', referenceId: dispatch.id, createdById: userId } });
    }
    const updatedOrder = await tx.salesOrder.update({ where: { id: orderId }, data: { status: 'DISPATCHED' }, include: salesOrderInclude });
    await audit(tx, { userId, action: 'DISPATCH_ORDER', entityType: 'DISPATCH', entityId: dispatch.id, metadata: { orderId, dispatchNumber: dispatch.dispatchNumber } });
    return { dispatch, salesOrder: updatedOrder };
  });
}
