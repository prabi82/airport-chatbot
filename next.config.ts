import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static exports for better performance
  output: 'standalone',
  
  // Optimize images
  images: {
    domains: ['localhost'],
    unoptimized: false,
  },
  
  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  },
  
  // Headers for security and CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/widget/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=300' }, // 5 minutes cache for development
        ],
      },
    ];
  }
};

export default nextConfig;
