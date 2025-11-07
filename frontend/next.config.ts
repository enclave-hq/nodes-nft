import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  // Optimize webpack for development
  // Note: Next.js 16 defaults to Turbopack, but we're using webpack for stability
  webpack: (config, { dev }) => {
    if (dev) {
      // Reduce memory usage in development
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**'],
      };
    }
    return config;
  },
  // Add empty turbopack config to silence the warning
  // When using webpack, this prevents the Turbopack/webpack conflict error
  turbopack: {},
};

export default nextConfig;
