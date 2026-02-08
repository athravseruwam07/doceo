import type { NextConfig } from "next";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
      {
        source: "/audio/:path*",
        destination: `${apiBaseUrl}/audio/:path*`,
      },
    ];
  },
};

export default nextConfig;
