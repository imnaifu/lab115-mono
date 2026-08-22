/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained `.next/standalone` server for the Docker runtime stage.
  output: "standalone",
  // Next 16 writes AGENTS.md/CLAUDE.md into the app on dev boot; this repo
  // keeps its conventions in the root README instead.
  agentRules: false,
};

export default nextConfig;
