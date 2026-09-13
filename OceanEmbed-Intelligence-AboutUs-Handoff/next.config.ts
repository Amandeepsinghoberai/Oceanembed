import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/technology',
        destination: '/model',
        permanent: true,
      },
      {
        source: '/data',
        destination: '/about-us',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
