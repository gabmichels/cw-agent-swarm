/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crowd-wisdom/core', '@crowd-wisdom/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@crowd-wisdom/core'],
  },
};

module.exports = nextConfig; 