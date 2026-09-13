const path = require('path');

const isWindows = process.platform === 'win32';
const aiPython = isWindows
  ? path.join('ai-service', '.venv', 'Scripts', 'python.exe')
  : path.join('ai-service', '.venv', 'bin', 'python');

module.exports = {
  apps: [
    {
      name: 'devpulse',
      script: 'backend/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_file: 'backend/.env',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      max_memory_restart: '500M',
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
    {
      name: 'devpulse-ai',
      cwd: path.join(__dirname, 'ai-service'),
      script: aiPython,
      interpreter: 'none',
      args: ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'],
      instances: 1,
      exec_mode: 'fork',
      env: {
        AI_SERVICE_PORT: 8000,
        NODE_API_URL: 'http://localhost:4000',
      },
      env_file: 'ai-service/.env',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/ai-err.log',
      out_file: 'logs/ai-out.log',
      merge_logs: true,
      max_memory_restart: '300M',
      kill_timeout: 5000,
    },
  ],
};