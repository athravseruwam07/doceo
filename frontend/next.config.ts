import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Lock Turbopack root to this app to avoid bad workspace inference.
    root: projectRoot,
  },
  webpack: (config, { isServer }) => {
    const resolve = config.resolve || {};

    // react-konva/konva may resolve a Node canvas dependency during bundling.
    // In browser-oriented Next apps we explicitly disable that resolution.
    resolve.alias = {
      ...(resolve.alias || {}),
      canvas: false,
    };

    // Keep module resolution anchored to frontend/node_modules regardless of cwd.
    resolve.modules = [
      path.join(projectRoot, "node_modules"),
      ...(resolve.modules || []),
    ];

    config.resolve = resolve;

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: "canvas" });
    }

    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "/api/auth/:path*",
      },
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
