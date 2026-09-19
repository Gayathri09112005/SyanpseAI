import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

export const notFoundHandler = (req, res) =>
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });

export function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let code = err.code || 'internal_error';
  let message = err.expose ? err.message : 'Something went wrong on our side.';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 422;
    code = 'validation_error';
    message = 'Validation failed';
    details = { fields: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })) };
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'invalid_id';
    message = 'Malformed identifier';
  } else if (err.code === 11000) {
    status = 409;
    code = 'duplicate';
    message = 'That value is already taken';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'payload_too_large';
    message = 'Request body is too large';
  }

  if (status >= 500) logger.error({ err, path: req.path }, 'request failed');
  else logger.debug({ code, path: req.path }, 'request rejected');

  const body = { error: { code, message, ...(details ? { details } : {}) } };
  if (!env.isProd && status >= 500) body.error.stack = err.stack;
  res.status(status).json(body);
}

export { AppError };
