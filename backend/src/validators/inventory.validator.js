import { z } from 'zod';
import { id, positiveInt } from './common.js';

export const receiptSchema = z.object({
  productId: id,
  quantity: positiveInt,
  note: z.string().trim().max(240).optional(),
});

