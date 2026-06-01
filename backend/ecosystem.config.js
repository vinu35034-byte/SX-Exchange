// PM2 Ecosystem Configuration
// Runs backend in cluster mode (one worker per CPU core)
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: 'max',         // use all available CPU cores
      watch: false,
      max_memory_restart: '2G',  // restart a worker if it exceeds 2 GB

      // Let all process.env variables pass through from Docker
      // Override specific values here only if needed
      env: {
        NODE_ENV: 'production',
      },

      // Node.js memory — give each worker up to 4 GB heap
      node_args: '--max-old-space-size=4096',

      // Logging — Docker captures stdout/stderr, disable PM2 log files
      out_file: '/dev/null',
      error_file: '/dev/null',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown
      kill_timeout: 8000,
      wait_ready: true,
      listen_timeout: 15000,

      // Restart strategy — back off after repeated crashes
      exp_backoff_restart_delay: 100,
    },
  ],
};
