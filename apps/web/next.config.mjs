/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@helena/btl', '@helena/db', '@helena/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb'
    }
  }
};

export default nextConfig;
