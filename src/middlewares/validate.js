const applyParsed = (target, parsed) => {
  if (!target || !parsed) return;
  for (const key of Object.keys(target)) delete target[key];
  for (const [key, value] of Object.entries(parsed)) target[key] = value;
};

export const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) applyParsed(req.query, schemas.query.parse(req.query));
    if (schemas.params) applyParsed(req.params, schemas.params.parse(req.params));
    next();
  } catch (err) {
    next(err);
  }
};
