import { listSites, resolveSite } from "./gsc";

/**
 * Which properties can this service account see, and which one will the other
 * scripts query?
 *
 * THE FIRST THING TO RUN, and the only script that answers a question about the
 * SETUP rather than about the site. Authorising a service account happens in the
 * Search Console UI — there is no API for it — so the failure mode is silent: the
 * key works, the token is issued, and every query 404s because the grant was
 * never made or was made at the wrong permission level. This separates those.
 *
 * `permissionLevel` matters as much as the list itself. `siteRestrictedUser`
 * can read Search Analytics but gets a 403 from URL Inspection, which is the
 * report this whole directory exists for — so it is printed, not just the URL.
 */
async function main() {
  const sites = await listSites();

  console.log(`\n可访问的资源（${sites.length} 个）:\n`);
  for (const site of sites) {
    const warning =
      site.permissionLevel === "siteRestrictedUser"
        ? "  ← 权限不足，URL 检查会 403，去 GSC 改成「完整」"
        : "";
    console.log(`  ${site.siteUrl}`);
    console.log(`    权限: ${site.permissionLevel}${warning}`);
  }

  const resolved = await resolveSite();
  console.log(`\n其余脚本会查: ${resolved}\n`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
