import { dispatchSalesOrder } from '../services/dispatch.service.js';
import { serialize } from '../utils/serializers.js';

export async function create(req, res) {
  const result = await dispatchSalesOrder(req.params.id, req.validatedBody, req.user.id);
  res.status(201).json({ success: true, data: serialize(result) });
}

