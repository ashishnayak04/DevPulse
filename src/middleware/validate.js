const { ZodError } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: messages.join('; '),
          },
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
