/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  serverExternalPackages: [],
  experimental: {
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
};

module.exports = nextConfig; 