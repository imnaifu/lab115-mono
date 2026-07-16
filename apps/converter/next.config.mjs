/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained `.next/standalone` server for the Docker runtime
  // stage — no need to ship node_modules or run `next start`.
  output: "standalone",
};

export default nextConfig;
