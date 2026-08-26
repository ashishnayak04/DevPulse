const levelOf = { debug: 10, info: 20, warn: 30, error: 40 };

function write(level, scope, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = scope ? `[${scope}]` : '';
  const line = `${timestamp} ${level.toUpperCase().padEnd(5)} ${prefix} ${message}`;

  if (levelOf[level] >= 30) {
    console.error(line, ...args);
  } else {
    console.log(line, ...args);
  }
}

module.exports = {
  debug: (scope, message, ...args) => write('debug', scope, message, ...args),
  info: (scope, message, ...args) => write('info', scope, message, ...args),
  warn: (scope, message, ...args) => write('warn', scope, message, ...args),
  error: (scope, message, ...args) => write('error', scope, message, ...args),
};
