const { ZodError } = require('zod');

/**
 * Creates an Express middleware that validates req.body against a Zod schema.
 * Returns 400 with formatted validation errors on failure.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed; // Replace with parsed (coerced/transformed) values
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
