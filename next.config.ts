import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `node:sqlite` is a Node builtin — keep it external to the server bundle.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("node:sqlite");
    }
    return config;
  },
};

export default nextConfig;
