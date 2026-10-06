import * as customerService from '../services/customer.service.js';
import { serialize } from '../utils/serializers.js';

export async function create(req, res) {
  const customer = await customerService.createCustomer(req.validatedBody);
  res.status(201).json({ success: true, data: serialize(customer) });
}

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await customerService.listCustomers()) });
}

export async function remove(req, res) {
  await customerService.deleteCustomer(req.params.id, req.user.id);
  res.status(204).end();
}

