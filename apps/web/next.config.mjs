/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@helena/btl', '@helena/db', '@helena/shared'],
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb'
    }
  },
  async headers() {
    // Applied to every route. Kept conservative so SSE from /api/copilot/turn
    // and dev-preview embedding still work.
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      }
    ];
    return [
      {
        source: '/:path*',
        headers: baseSecurity
      }
    ];
  }
};

export default nextConfig;
