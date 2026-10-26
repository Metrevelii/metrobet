import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const media = new URL(process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:4000/media');

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: media.protocol === 'https:' ? 'https' : 'http',
        hostname: media.hostname,
        port: media.port,
        pathname: `${media.pathname.replace(/\/$/, '')}/**`,
      },
    ],
    dangerouslyAllowLocalIP: process.env.IMAGES_ALLOW_LOCAL_IP === 'true',
  },
  experimental: {
    optimizePackageImports: ['@metrobet/ui'],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withNextIntl(nextConfig);
