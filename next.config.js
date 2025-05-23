/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  serverExternalPackages: ['zlib-sync', 'discord.js'],
  experimental: {
    // Force fresh compilation
    forceSwcTransforms: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Disable webpack caching in development
    if (dev) {
      config.cache = false;
      
      // Force module resolution to always check file system
      config.resolve.cache = false;
      
      // Disable persistent caching
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    
    // Always resolve TypeScript files properly
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
    };
    
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