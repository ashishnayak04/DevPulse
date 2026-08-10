module.exports = {
  apps: [
    {
      name: 'devpulse',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_file: '.env',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      max_memory_restart: '500M',
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
