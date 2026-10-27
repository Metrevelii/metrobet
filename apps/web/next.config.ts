import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const media = new URL(process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:4000/media');

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      // Provider covers for the dev-only public demo adapter (CASINO_AGGREGATOR=public-demos in the api).
      { protocol: 'https', hostname: 'common-static.ppgames.net', pathname: '/game_pic/**' },
      { protocol: 'https', hostname: 'bgaming.com', pathname: '/wp-content/uploads/**' },
      {
        protocol: media.protocol === 'https:' ? 'https' : 'http',
        hostname: media.hostname,
        port: media.port,
        pathname: `${media.pathname.replace(/\/$/, '')}/**`,
      },
    ],
    dangerouslyAllowLocalIP: process.env.IMAGES_ALLOW_LOCAL_IP === 'true',
  },
  /** "Casino" was renamed "Slots", and categories became a `?category=` filter: keep old links working. */
  async redirects() {
    return [
      {
        source: '/slots/:category(new|jackpots|popular)',
        destination: '/slots?category=:category',
        permanent: true,
      },
      {
        source: '/:locale(en|ru|ka)/slots/:category(new|jackpots|popular)',
        destination: '/:locale/slots?category=:category',
        permanent: true,
      },
      { source: '/casino/:path*', destination: '/slots/:path*', permanent: true },
      {
        source: '/:locale(en|ru|ka)/casino/:path*',
        destination: '/:locale/slots/:path*',
        permanent: true,
      },
      { source: '/casino', destination: '/slots', permanent: true },
      { source: '/:locale(en|ru|ka)/casino', destination: '/:locale/slots', permanent: true },
    ];
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
