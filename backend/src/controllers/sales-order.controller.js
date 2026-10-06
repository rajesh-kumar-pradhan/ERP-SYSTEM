import * as salesOrderService from '../services/sales-order.service.js';
import { cancelSalesOrder, confirmSalesOrder } from '../services/inventory.service.js';
import { serialize } from '../utils/serializers.js';

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await salesOrderService.listSalesOrders()) });
}

export async function get(req, res) {
  res.json({ success: true, data: serialize(await salesOrderService.getSalesOrder(req.params.id)) });
}

export async function confirm(req, res) {
  const order = await confirmSalesOrder(req.params.id, req.user.id);
  res.json({ success: true, data: serialize(order) });
}

export async function cancel(req, res) {
  const order = await cancelSalesOrder(req.params.id, req.user.id);
  res.json({ success: true, data: serialize(order) });
}

