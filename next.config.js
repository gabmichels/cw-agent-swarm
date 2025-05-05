/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  serverExternalPackages: [],
  experimental: {
    serverComponentsExternalPackages: [],
  },
  webpack: (config, { isServer }) => {
    // For both client and server
    // This is a workaround for compatibility issues with binary modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };

    return config;
  },
  // Add rewrites for memory API routes to ensure they're properly handled
  async rewrites() {
    return [
      {
        source: '/api/memory',
        destination: '/api/memory',
        has: [{ type: 'header', key: 'x-use-app-router', value: 'true' }],
      },
      {
        source: '/api/memory/:path*',
        destination: '/api/memory/:path*',
        has: [{ type: 'header', key: 'x-use-app-router', value: 'true' }],
      }
    ];
  },
};

module.exports = nextConfig; 