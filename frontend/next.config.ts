import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack to avoid Map maximum size exceeded error
  // Use webpack instead (more stable for large projects)
  // You can re-enable Turbopack once the issue is resolved upstream
  experimental: {
    turbo: false,
  },
  // Optimize webpack for development
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
};

export default nextConfig;
