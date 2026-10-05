import * as inventoryService from '../services/inventory.service.js';
import { serialize } from '../utils/serializers.js';

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await inventoryService.listInventory()) });
}

export async function movements(req, res) {
  res.json({ success: true, data: serialize(await inventoryService.listMovements(req.query.productId)) });
}

export async function receive(req, res) {
  const inventory = await inventoryService.receiveStock(req.validatedBody, req.user.id);
  res.status(201).json({ success: true, data: serialize(inventory) });
}

