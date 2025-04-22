/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  serverExternalPackages: ["@lancedb/lancedb", "@lancedb/lancedb-win32-x64-msvc"],
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ["@lancedb/lancedb", "@lancedb/lancedb-win32-x64-msvc"],
  },
  webpack: (config, { isServer }) => {
    // Only on the server
    if (isServer) {
      // Mark LanceDB packages as external
      config.externals.push(
        "@lancedb/lancedb",
        "@lancedb/lancedb-win32-x64-msvc"
      );
    }

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