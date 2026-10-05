import { z } from 'zod';
import { id, positiveInt } from './common.js';

export const enquirySchema = z.object({
  customerId: id,
  enquiryDate: z.coerce.date().optional(),
  requiredDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(z.object({ productId: id, quantity: positiveInt })).min(1),
}).refine((data) => data.requiredDate >= (data.enquiryDate || new Date(new Date().setHours(0, 0, 0, 0))), {
  message: 'Required date cannot be before enquiry date', path: ['requiredDate'],
});

