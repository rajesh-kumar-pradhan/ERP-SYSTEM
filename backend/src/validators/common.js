import { z } from 'zod';

export const id = z.string().min(1);
export const positiveInt = z.coerce.number().int().positive();
export const nonNegativeMoney = z.union([z.string(), z.number()]).refine(
  (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
  'Must be a non-negative number',
);
export const percentage = z.union([z.string(), z.number()]).refine(
  (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100,
  'Must be between 0 and 100',
);

