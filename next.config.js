/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  serverExternalPackages: [],
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig; 