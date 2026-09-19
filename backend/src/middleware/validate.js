import { AppError } from '../utils/AppError.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(
      new AppError(422, 'Validation failed', 'validation_error', {
        fields: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    );
  }
  req.valid = { ...req.valid, [source]: result.data };
  next();
};
