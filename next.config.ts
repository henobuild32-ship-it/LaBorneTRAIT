import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Permet de builder dans un dossier séparé (ex: NEXT_DIST_DIR=.next-prod)
  // sans perturber un serveur `next dev` qui utilise déjà .next/.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  allowedDevOrigins: ["*"],
  // Packages using native bindings ou des workers chargés à l'exécution :
  // ils doivent être require() depuis node_modules, pas bundlés par Turbopack.
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
    "tesseract.js",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns", "sonner"],
  },
  turbopack: {},
};

export default withSerwist(nextConfig);
