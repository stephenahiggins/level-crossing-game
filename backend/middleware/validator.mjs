export const zValidator = (schema, source = 'body') => (req, res, next) => {
  const data = req[source];
  const result = schema.safeParse(data);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
  }
  req[source] = result.data;
  next();
};
