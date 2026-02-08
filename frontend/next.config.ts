import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
      {
        source: "/audio/:path*",
        destination: "http://localhost:8000/audio/:path*",
      },
    ];
  },
};

export default nextConfig;
