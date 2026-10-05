export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (entity) => new AppError(`${entity} not found`, 404, 'NOT_FOUND');
export const conflict = (message, code = 'CONFLICT') => new AppError(message, 409, code);

