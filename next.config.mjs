/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security
  poweredByHeader: false,
  // Playwright uses native binaries — must NOT be bundled by webpack
  serverExternalPackages: ['playwright', 'playwright-core'],
};

export default nextConfig;
