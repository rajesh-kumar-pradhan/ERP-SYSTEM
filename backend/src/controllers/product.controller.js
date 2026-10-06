import { createProduct, listProducts } from '../services/product.service.js';
import { serialize } from '../utils/serializers.js';

export async function create(req, res) {
  const product = await createProduct(req.validatedBody, req.user.id);
  res.status(201).json({ success: true, data: serialize(product) });
}

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await listProducts()) });
}

