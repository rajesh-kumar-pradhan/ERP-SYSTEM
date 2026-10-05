import { z } from 'zod';
import { id, nonNegativeMoney, percentage, positiveInt } from './common.js';

export const quotationSchema = z.object({
  enquiryId: id,
  validUntil: z.coerce.date(),
  items: z.array(z.object({
    productId: id,
    quantity: positiveInt,
    unitPrice: nonNegativeMoney,
    discountPercent: percentage.optional().default(0),
    gstPercent: percentage.optional().default(18),
  })).min(1),
});

export const quotationStatusSchema = z.object({
  status: z.enum(['SENT', 'ACCEPTED', 'REJECTED']),
});

