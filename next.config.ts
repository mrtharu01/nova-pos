import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
 
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  output: "standalone",
  transpilePackages: ["motion"],
};

export default nextConfig;
