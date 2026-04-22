import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  allowedDevOrigins: ['unpenetrant-irish-unaphasic.ngrok-free.dev'],
};

export default nextConfig;
