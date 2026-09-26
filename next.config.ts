import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth / pdf-parse load native or worker assets — keep them external on the server.
  serverExternalPackages: ["mammoth", "pdf-parse", "docx", "sharp", "heic-convert"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
