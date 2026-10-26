import { MEDIA_MAX_BYTES } from '@metrobet/contracts';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    optimizePackageImports: ['@metrobet/ui'],
    // Image uploads go through a Server Action: allow the media limit plus multipart overhead.
    serverActions: { bodySizeLimit: MEDIA_MAX_BYTES + 512 * 1024 },
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

export default nextConfig;
