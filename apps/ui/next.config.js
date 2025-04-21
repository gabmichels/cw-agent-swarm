/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crowd-wisdom/core', '@crowd-wisdom/shared'],
  serverExternalPackages: [],
};

module.exports = nextConfig; 