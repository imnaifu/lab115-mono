import { BlockList, isIPv6 } from "node:net";

/**
 * The reader's IP, for the subscribe rate limit — correct whether or not the
 * site is behind Cloudflare's proxy.
 *
 * WHAT TRAEFIK HANDS US. It is not configured to trust anyone's forwarding
 * headers, so it discards whatever `x-forwarded-for` arrived and writes the
 * address of the machine that actually opened the connection. The first hop is
 * therefore never spoofed — but behind the orange cloud that machine is a
 * Cloudflare edge, shared by every reader routed through it, and a per-IP limit
 * keyed on it would put all of them in one bucket of five.
 *
 * SO `cf-connecting-ip` IS READ, BUT ONLY FROM CLOUDFLARE. The origin's address
 * is public (every lab115.com host points at it), so anyone can skip the proxy
 * and send that header themselves to get a fresh bucket per request. It counts
 * only when the connecting hop is inside Cloudflare's published ranges; from
 * anywhere else the hop itself is the client.
 *
 * The ranges are https://www.cloudflare.com/ips-v4 and /ips-v6 as of 2026-10-08.
 * They change rarely. A range missing here degrades to the old behaviour — the
 * edge's own IP — rather than to anything spoofable.
 */
const CLOUDFLARE = new BlockList();
for (const range of [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
]) {
  const [network, prefix] = range.split("/");
  CLOUDFLARE.addSubnet(network, Number(prefix), isIPv6(network) ? "ipv6" : "ipv4");
}

function fromCloudflare(address: string): boolean {
  // Node reports IPv4 peers on a dual-stack socket as `::ffff:a.b.c.d`.
  const plain = address.replace(/^::ffff:/, "");
  try {
    return CLOUDFLARE.check(plain, isIPv6(plain) ? "ipv6" : "ipv4");
  } catch {
    // Not an address at all — never grounds for trusting a header.
    return false;
  }
}

export function clientIp(headers: Headers): string {
  const hop = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!hop) return "unknown";
  if (fromCloudflare(hop)) {
    return headers.get("cf-connecting-ip")?.trim() || hop;
  }
  return hop;
}
