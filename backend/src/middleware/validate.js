import { AppError } from '../utils/app-error.js';

export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError('Request validation failed', 422, 'VALIDATION_ERROR', parsed.error.flatten()));
    }
    req.validatedBody = parsed.data;
    return next();
  };
}

