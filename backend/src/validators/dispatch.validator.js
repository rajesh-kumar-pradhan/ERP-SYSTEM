import { z } from 'zod';

export const dispatchSchema = z.object({
  vehicleNumber: z.string().trim().min(2).max(40),
  driverName: z.string().trim().min(2).max(120),
  dispatchDate: z.coerce.date().optional(),
});

