import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth / pdf-parse load native or worker assets — keep them external on the server.
  serverExternalPackages: [
    "mammoth",
    "pdf-parse",
    "docx",
    "sharp",
    "heic-convert",
    "tesseract.js",
  ],
  // OCR language data is read by path at runtime, so tracing can't see it.
  outputFileTracingIncludes: {
    "/grading/**": ["./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
