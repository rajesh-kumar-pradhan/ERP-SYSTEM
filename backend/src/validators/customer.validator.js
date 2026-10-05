import { z } from 'zod';

export const customerSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactPerson: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(7).max(25),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  city: z.string().trim().min(2).max(100),
});

