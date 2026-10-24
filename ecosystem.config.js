/**
 * PM2 Ecosystem Configuration
 * Production process management with cluster scaling and automatic crash recovery
 */

module.exports = {
  apps: [
    {
      name: 'technofay-fleet-api',
      script: './apps/api/src/server.js',
      instances: 'max', // Scales across all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
