import * as enquiryService from '../services/enquiry.service.js';
import { serialize } from '../utils/serializers.js';

export async function create(req, res) {
  const enquiry = await enquiryService.createEnquiry(req.validatedBody, req.user.id);
  res.status(201).json({ success: true, data: serialize(enquiry) });
}

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await enquiryService.listEnquiries()) });
}

export async function get(req, res) {
  res.json({ success: true, data: serialize(await enquiryService.getEnquiry(req.params.id)) });
}

