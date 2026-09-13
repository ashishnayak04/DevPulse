const levelOf = { debug: 10, info: 20, warn: 30, error: 40 };

const SECRET_KEY_PATTERN =
  /^(pass(word)?|password|secret|token|refreshToken|accessToken|api[_-]?key|key|auth|cookie|authorization|smtp[_-]?pass|github[_-]?token|ai[_-]?service[_-]?token|jwt[_-]?secret|private[_-]?key|.*bearer)$/i;
const SECRET_STRING_PATTERN =
  /\b(Bearer\s+|Basic\s+|dpk_)[A-Za-z0-9+/\-_=.]{6,}\b|([=:]\s*)(sk-[A-Za-z0-9\-_]{8,}|ghp_[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9\-]{10,})/g;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function redactValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') {
    return value.replace(SECRET_STRING_PATTERN, (match, prefix) => `${prefix || ''}[REDACTED]`);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    return value.map((item) => redactValue(item, seen));
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(String(key))) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactValue(val, seen);
      }
    }
    return out;
  }
  return value;
}

const useJsonOutput = () =>
  (process.env.LOG_FORMAT || '') === 'json' || process.env.NODE_ENV === 'production';

function write(level, scope, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = scope ? `[${scope}]` : '';

  const redactedArgs = args.map((arg) => redactValue(arg));
  const safeMessage = redactValue(String(message));

  if (useJsonOutput()) {
    const entry = {
      ts: timestamp,
      level,
      scope: scope || null,
      msg: safeMessage,
      ...(redactedArgs.length > 0 ? { meta: redactedArgs } : {}),
    };
    if (levelOf[level] >= 30) {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
    return;
  }

  const line = `${timestamp} ${level.toUpperCase().padEnd(5)} ${prefix} ${safeMessage}`;

  if (levelOf[level] >= 30) {
    console.error(line, ...redactedArgs);
  } else {
    console.log(line, ...redactedArgs);
  }
}

module.exports = {
  debug: (scope, message, ...args) => write('debug', scope, message, ...args),
  info: (scope, message, ...args) => write('info', scope, message, ...args),
  warn: (scope, message, ...args) => write('warn', scope, message, ...args),
  error: (scope, message, ...args) => write('error', scope, message, ...args),
  redact: (value) => redactValue(value),
  useJsonOutput,
};