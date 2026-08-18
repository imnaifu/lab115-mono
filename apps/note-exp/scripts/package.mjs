/**
 * Build the extension and produce a versioned zip ready to upload to the
 * Chrome Web Store. The zip puts manifest.json at its root (required by the
 * store) and excludes macOS .DS_Store metadata.
 *
 * Usage: npm run package
 */
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

// Version drives the output filename so each upload is easy to identify.
const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const zipName = `rednote-exporter-v${version}.zip`;

// 1. Fresh production build into dist/
execSync("npm run build", { stdio: "inherit" });

// 2. Replace any stale archive of the same name
rmSync(zipName, { force: true });

// 3. Zip the contents of dist/ (cwd: dist => manifest.json lands at zip root)
execSync(`zip -r ../"${zipName}" . -x "*.DS_Store"`, {
  cwd: "dist",
  stdio: "inherit",
});

console.log(`\n✓ Created ${zipName} — upload this to the Chrome Web Store.`);
