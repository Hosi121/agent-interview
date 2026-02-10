import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
