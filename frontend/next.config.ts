import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    // react-konva/konva may resolve a Node canvas dependency during bundling.
    // In browser-oriented Next apps we explicitly disable that resolution.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: "canvas" });
    }

    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
      {
        source: "/audio/:path*",
        destination: `${backendUrl}/audio/:path*`,
      },
    ];
  },
};

export default nextConfig;
