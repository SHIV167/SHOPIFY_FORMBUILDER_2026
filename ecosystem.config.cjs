module.exports = {
  apps: [
    {
      name: 'formbuilderapp',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        // Fix HTTP 431 - Increase max header size to 256KB for Shopify OAuth callbacks
        NODE_OPTIONS: '--max-http-header-size=262144',
      },
    },
  ],
};