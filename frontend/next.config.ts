import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (Next.js 16 default) — needs explicit opt-in for WASM
  turbopack: {
    // Turbopack handles WASM natively; no extra config needed for our use
  },
  // Fallback webpack config for `next build` (non-Turbopack)
  webpack(config, { isServer }) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (isServer) {
      config.externals = [...(config.externals ?? []), "snarkjs", "circomlibjs"];
    }
    return config;
  },
};

export default nextConfig;
