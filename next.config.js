/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['cdn.shopify.com'],
  },
  // Fix chunk loading issues
  generateEtags: false,
  compress: false,
};

module.exports = nextConfig;
