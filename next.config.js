/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  serverExternalPackages: [],
  experimental: {
  },
  webpack: (config, { isServer }) => {
    // Only apply Node.js polyfills in the browser
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve.fallback,
          fs: false,
          path: false,
          os: false,
          dns: false,
          net: false,
          tls: false
        },
        alias: {
          ...config.resolve.alias,
          'node:events': 'events',
          'node:stream': 'stream-browserify',
          'node:buffer': 'buffer',
          'node:util': 'util',
          'node:process': 'process/browser',
          'node:path': 'path-browserify',
          'node:crypto': 'crypto-browserify',
          'node:assert': 'assert',
          'node:http': 'stream-http',
          'node:https': 'https-browserify',
          'node:zlib': 'browserify-zlib',
          'node:querystring': 'querystring-es3',
          stream: 'stream-browserify',
          crypto: 'crypto-browserify',
          events: 'events',
          path: 'path-browserify',
          util: 'util'
        },
      };
      
      // Add process polyfill
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    return config;
  },
};

module.exports = nextConfig; 