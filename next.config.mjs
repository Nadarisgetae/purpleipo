/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14: mark heavy server-only packages as external so they are
  // never bundled or executed during Vercel's static build scan phase.
  experimental: {
    serverComponentsExternalPackages: [
      'postgres',
      '@aws-sdk/client-s3',
      '@google/generative-ai',
      'pdf-parse',
    ],
  },

  // Security
  poweredByHeader: false,
};

export default nextConfig;

