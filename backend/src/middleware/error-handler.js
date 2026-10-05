import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} was not found`, 404, 'NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A record with this value already exists', code: 'CONFLICT' });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ success: false, message: 'Operation violates a related business record', code: 'CONFLICT' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found', code: 'NOT_FOUND' });
    }
  }

  const status = error instanceof AppError ? error.statusCode : 500;
  const body = {
    success: false,
    message: error instanceof AppError ? error.message : 'An unexpected server error occurred',
    code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
  };
  if (error instanceof AppError && error.details) body.details = error.details;
  if (status >= 500) console.error(error);
  return res.status(status).json(body);
}

