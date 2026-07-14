import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow an isolated build dir (e.g. for a parallel preview server) without
  // clobbering the default .next. Defaults to normal behaviour when unset.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
