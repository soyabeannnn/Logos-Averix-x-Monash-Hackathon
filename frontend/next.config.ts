import type { NextConfig } from "next";

/** Where the FastAPI backend runs. The browser only ever talks to /api/*, which is proxied here. */
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Set NEXT_OUTPUT=standalone (the Dockerfile does) for a slim production image.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
