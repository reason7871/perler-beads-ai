// Load .env.production manually (standalone mode doesn't auto-load it)
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '.env.production');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([A-Za-z_]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
} catch (e) {
  // .env.production not found, skip
}

module.exports = {
  apps: [
    {
      name: 'perler-beads',
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false
    }
  ]
};
