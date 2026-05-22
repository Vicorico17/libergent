import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const isDev = process.env.NODE_ENV === "development";
const uiRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  turbopack: {
    root: uiRoot,
  },
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.LIBERGENT_API_BASE || "http://127.0.0.1:8787"}/api/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
