/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  // Lets a production build (e.g. for sharing) live beside the dev server's .next without clobbering it.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Same-origin proxy: the session cookie stays SameSite=Lax in development and
  // the browser never learns the API host.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
