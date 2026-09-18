import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Search Console API access — WITHOUT `google-auth-library`, WITHOUT `googleapis`.
 *
 * The usual way to authenticate a service account is to install Google's auth
 * SDK, which for this purpose does exactly one thing: sign a JWT with RS256 and
 * trade it for an access token. `node:crypto` signs RS256 already. So the whole
 * dependency reduces to the thirty lines below, and this directory stays
 * something you can read end to end.
 *
 * That is the same call TRACKING.md makes about analytics ("没有引入任何第三方
 * SDK") — stated here too because the reasoning has to survive the next person
 * who reaches for `npm i` when they add a third endpoint.
 *
 * THE KEY IS NEVER IN THE REPO. It lives at `~/.config/gsc/lab115.json`, mode
 * 600, and it is a long-lived credential that can read every byte of Search
 * Console data for every property it has been granted. `GSC_KEY_FILE` overrides
 * the path; nothing here ever writes it anywhere.
 */

/** Where the service account key lives. See the note above. */
const KEY_FILE =
  process.env.GSC_KEY_FILE ?? resolve(homedir(), ".config/gsc/lab115.json");

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * READ-ONLY, deliberately.
 *
 * The write scope (`.../auth/webmasters`) would additionally let this submit and
 * DELETE sitemaps. Nothing in this directory wants that, and a credential sitting
 * on a laptop should not carry a permission its scripts never exercise.
 */
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/**
 * TWO HOSTS, ONE API, and this is not a mistake in the constants.
 *
 * Search Analytics is still served under the old `webmasters/v3` path — it was
 * never re-homed when the API was renamed — while URL Inspection only exists at
 * `searchconsole.googleapis.com/v1`. Enabling `searchconsole.googleapis.com` in
 * the GCP project covers both; the paths simply never got unified.
 */
const WEBMASTERS_V3 = "https://www.googleapis.com/webmasters/v3";
const SEARCHCONSOLE_V1 = "https://searchconsole.googleapis.com/v1";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

let loadedKey: ServiceAccountKey | null = null;

function serviceAccountKey(): ServiceAccountKey {
  if (loadedKey) return loadedKey;
  let raw: string;
  try {
    raw = readFileSync(KEY_FILE, "utf8");
  } catch {
    throw new Error(
      `找不到 service account 密钥：${KEY_FILE}\n` +
        `用 GSC_KEY_FILE 指定别的路径，或重新生成：\n` +
        `gcloud iam service-accounts keys create ${KEY_FILE} --iam-account=gsc-reader@lab115-gsc-001.iam.gserviceaccount.com`,
    );
  }
  const parsed = JSON.parse(raw) as ServiceAccountKey;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(`密钥文件缺 client_email 或 private_key：${KEY_FILE}`);
  }
  loadedKey = parsed;
  return parsed;
}

/**
 * base64url — NOT base64.
 *
 * JWT segments are base64url (`-` and `_` for `+` and `/`, no `=` padding), and
 * a plain base64 here produces a token the endpoint rejects with an opaque
 * `invalid_grant`. Node's `"base64url"` encoding does the whole substitution.
 */
function base64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * The signed JWT that stands in for a password.
 *
 * `aud` MUST be the token endpoint itself rather than the API being called —
 * this assertion authenticates to Google's OAuth server, which then issues the
 * token the API accepts. Getting that wrong is the other common `invalid_grant`.
 *
 * An hour is the maximum lifetime Google accepts, and it costs nothing here: the
 * assertion is spent immediately for a token and never stored.
 */
function signedAssertion(): string {
  const key = serviceAccountKey();
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(key.private_key)
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

/**
 * The access token, reused until shortly before it expires.
 *
 * MODULE STATE, which is per-process — right here, because a script runs once
 * and a coverage sweep makes hundreds of calls inside a single hour. Re-signing
 * a JWT per request would be several hundred pointless round trips to the token
 * endpoint.
 *
 * The 60-second margin is for the sweep that starts a request at 3599 seconds:
 * a token that expires mid-flight fails the call, not the refresh.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedAssertion(),
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `换取 access token 失败 (${response.status}): ${payload.error ?? ""} ${payload.error_description ?? ""}`.trim(),
    );
  }
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/**
 * One API call, with the retry that the quotas below make mandatory.
 *
 * 429 AND 5xx ARE RETRIED, everything else is thrown. A coverage sweep is ~380
 * calls against a per-minute limit, so brushing the limit is an expected part of
 * normal operation rather than an error — but a 403 (wrong permission level in
 * Search Console) or a 404 (wrong property identifier) will never succeed on a
 * second attempt, and retrying those just delays a message the caller needs to
 * read.
 *
 * Backoff is exponential from one second. Google's per-minute windows are not
 * sliding, so a few seconds of waiting genuinely clears them.
 */
async function call<T>(
  url: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<T> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: init.method,
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (response.ok) return (await response.json()) as T;

    const retryable = response.status === 429 || response.status >= 500;
    const detail = await response.text();
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`${init.method} ${url} → ${response.status}\n${detail}`);
    }
    const waitMs = 1000 * 2 ** (attempt - 1);
    console.error(
      `  ${response.status}，${waitMs / 1000}s 后重试（第 ${attempt}/${maxAttempts - 1} 次）`,
    );
    await new Promise((done) => setTimeout(done, waitMs));
  }
  throw new Error("unreachable");
}

export type Site = {
  siteUrl: string;
  permissionLevel: string;
};

/** Every property this service account has been granted. */
export async function listSites(): Promise<Site[]> {
  const payload = await call<{ siteEntry?: Site[] }>(`${WEBMASTERS_V3}/sites`);
  return payload.siteEntry ?? [];
}

/**
 * WHICH PROPERTY TO QUERY — resolved from the API rather than hardcoded.
 *
 * A Search Console property identifier is either `https://daily.lab115.com/`
 * (URL-prefix, trailing slash load-bearing) or `sc-domain:lab115.com` (domain
 * property), and the two are not interchangeable: the wrong one 404s every
 * request. Rather than write a guess into a constant, this asks `sites.list`
 * what the account actually has and matches on the host.
 *
 * `GSC_SITE` overrides it — for the day there are two matching properties, or
 * for a different site entirely.
 */
export async function resolveSite(host = "daily.lab115.com"): Promise<string> {
  const override = process.env.GSC_SITE;
  if (override) return override;

  const sites = await listSites();
  if (!sites.length) {
    throw new Error(
      `这个 service account 没有任何 Search Console 资源。\n` +
        `去 GSC → 设置 → 用户和权限，把 ${serviceAccountKey().client_email} 加为「完整」用户。`,
    );
  }
  const domainRoot = host.split(".").slice(-2).join(".");
  const match =
    sites.find((site) => site.siteUrl === `https://${host}/`) ??
    sites.find((site) => site.siteUrl === `sc-domain:${host}`) ??
    sites.find((site) => site.siteUrl === `sc-domain:${domainRoot}`) ??
    sites.find((site) => site.siteUrl.includes(host));
  if (!match) {
    throw new Error(
      `没找到 ${host} 对应的资源。这个账号能看到的是：\n` +
        sites.map((site) => `  ${site.siteUrl} (${site.permissionLevel})`).join("\n"),
    );
  }
  return match.siteUrl;
}

export type IndexStatus = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
  googleCanonical?: string;
  userCanonical?: string;
  crawledAs?: string;
  sitemap?: string[];
  referringUrls?: string[];
};

/**
 * One URL's index status, straight from Google.
 *
 * THIS IS THE ONLY WAY TO GET THIS DATA IN BULK. The «编制索引 → 网页» report in
 * the UI exports a summary plus at most 1,000 example URLs per reason — it will
 * not tell you the status of a URL you name. Inspecting one at a time in the UI
 * does, at roughly ten seconds of clicking each.
 *
 * QUOTA: 2,000 URLs per day per property, 600 per minute. The per-day ceiling is
 * why coverage.ts inspects the default-language URLs only — ~380 of them, where
 * inspecting both languages would be ~760 and leave no room to re-run.
 */
export async function inspect(
  siteUrl: string,
  inspectionUrl: string,
): Promise<IndexStatus> {
  const payload = await call<{
    inspectionResult?: { indexStatusResult?: IndexStatus };
  }>(`${SEARCHCONSOLE_V1}/urlInspection/index:inspect`, {
    method: "POST",
    body: { inspectionUrl, siteUrl, languageCode: "zh-CN" },
  });
  return payload.inspectionResult?.indexStatusResult ?? {};
}

export type SearchAnalyticsRow = {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Search Analytics, paged to exhaustion.
 *
 * `rowLimit` caps at 25,000 per request and the API pages with `startRow`, so a
 * caller that ignores paging silently gets a truncated answer — which for a
 * `query` breakdown is the difference between "these are the searches" and
 * "these are some of the searches". The loop stops on a short page, which is the
 * documented end-of-results signal.
 *
 * `dataState: "all"` INCLUDES FRESH, NOT-YET-FINALISED DATA. Search Console's
 * default holds numbers back two to three days; for a site being asked "is
 * anything happening at all", a three-day blind spot at the end of the window is
 * exactly the part worth seeing. It also means the last couple of days will
 * revise upward later, so they are not a trend.
 */
export async function searchAnalytics(
  siteUrl: string,
  request: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    type?: string;
  },
): Promise<SearchAnalyticsRow[]> {
  const pageSize = 25_000;
  const rows: SearchAnalyticsRow[] = [];
  for (let startRow = 0; ; startRow += pageSize) {
    const payload = await call<{ rows?: SearchAnalyticsRow[] }>(
      `${WEBMASTERS_V3}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        body: { ...request, dataState: "all", rowLimit: pageSize, startRow },
      },
    );
    const page = payload.rows ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
