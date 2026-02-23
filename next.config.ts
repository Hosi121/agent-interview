import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "sharp"],
};

export default async (): Promise<NextConfig> => {
  if (process.env.ANALYZE === "true") {
    const withBundleAnalyzer = (await import("@next/bundle-analyzer")).default({
      enabled: true,
    });
    return withBundleAnalyzer(nextConfig);
  }
  return nextConfig;
};
