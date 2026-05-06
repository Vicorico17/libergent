import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
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
