import type { NextConfig } from "next";

// NOTE (2026-09-06): turbopack.root, turbopack.resolveAlias.next, and
// outputFileTracingRoot were previously present as workarounds for a
// Turbopack panic ("get_next_server_import_map: Next.js package not found")
// caused by .git residing at D:\Cinepvq while package.json is in
// D:\Cinepvq\cinepvq-web.
//
// After testing with Next.js 16.2.12 (Turbopack) on 2026-09-06:
//   - /phim/[slug] compiles and serves 200 OK WITHOUT these options.
//   - No panic, no hmr_version_state error, no rebuild loop observed.
//   - All 3 options confirmed UNNECESSARY for this project layout.
//   - Build: PASS (33/33 routes). Dev: Ready in 715ms.
//
// Do NOT re-add these without first verifying a concrete panic recurrence.

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/search",
        destination: "/tim-kiem",
      },
    ];
  },
};

export default nextConfig;
