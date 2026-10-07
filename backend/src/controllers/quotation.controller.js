import * as quotationService from '../services/quotation.service.js';
import { serialize } from '../utils/serializers.js';

export async function create(req, res) {
  const quotation = await quotationService.createQuotation(req.validatedBody, req.user.id);
  res.status(201).json({ success: true, data: serialize(quotation) });
}

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await quotationService.listQuotations()) });
}

export async function get(req, res) {
  res.json({ success: true, data: serialize(await quotationService.getQuotation(req.params.id)) });
}

export async function updateStatus(req, res) {
  const quotation = await quotationService.transitionQuotation(req.params.id, req.validatedBody.status, req.user.id, req.user.role);
  res.json({ success: true, data: serialize(quotation) });
}

export async function convert(req, res) {
  const order = await quotationService.convertQuotation(req.params.id, req.user.id);
  res.status(201).json({ success: true, data: serialize(order) });
}

