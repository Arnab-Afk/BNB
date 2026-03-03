import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for builds — snarkjs/circomlibjs have file: URLs that Turbopack can't handle
  webpack(config, { isServer }) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (isServer) {
      config.externals = [...(config.externals ?? []), "snarkjs", "circomlibjs"];
    }
    return config;
  },
};

export default nextConfig;
