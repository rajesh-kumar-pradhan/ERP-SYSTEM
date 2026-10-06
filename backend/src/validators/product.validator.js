import { z } from 'zod';
import { nonNegativeMoney } from './common.js';

export const productSchema = z.object({
  productCode: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(30),
  basePrice: nonNegativeMoney,
  initialQuantity: z.coerce.number().int().min(0),
});
