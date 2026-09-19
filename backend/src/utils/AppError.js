export class AppError extends Error {
  constructor(status, message, code = 'error', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}
export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`, 'not_found');
export const forbidden = () => new AppError(403, 'You do not have access to this resource', 'forbidden');
export const unauthorized = () => new AppError(401, 'Authentication required', 'unauthorized');
