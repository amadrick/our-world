import type { NextConfig } from "next";

const DAY = 60 * 60 * 24;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  async headers() {
    return [
      // The guide is shared by link, not listed in search.
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // Place pictures carry a content hash in their names, and the MapLibre worker its version.
      ...["/places/:file*", "/maplibre/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      })),
      ...["/offline-tiles/:path*", "/offline-terrain/:path*", "/fonts/:path*", "/textures/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: `public, max-age=${DAY}, stale-while-revalidate=${7 * DAY}` }],
      })),
    ];
  },
};

export default nextConfig;
