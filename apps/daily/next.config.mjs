/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained `.next/standalone` server for the Docker runtime stage.
  output: "standalone",
  // Article covers come straight from the source sites (XDA's CDN, blog inline
  // images). We render them with a plain <img>, so Next's image optimizer is
  // never involved and no remotePatterns allowlist is needed.
  images: { unoptimized: true },
  // Next 16 writes AGENTS.md/CLAUDE.md into the app on dev boot; this repo
  // keeps its conventions in the root README instead.
  agentRules: false,
};

export default nextConfig;
