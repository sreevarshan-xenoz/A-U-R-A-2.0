/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
      os: false,
      path: false,
      stream: false,
      zlib: false,
      buffer: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig; 