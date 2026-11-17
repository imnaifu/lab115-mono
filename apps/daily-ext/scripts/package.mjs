/**
 * Build and zip for the Chrome Web Store: manifest.json at the zip root, no
 * .DS_Store. The version in manifest.json names the file.
 *
 * Usage: npm run package
 */
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const zipName = `daily-picks-v${version}.zip`;

execSync("npm run build", { stdio: "inherit" });
rmSync(zipName, { force: true });
execSync(`zip -r ../"${zipName}" . -x "*.DS_Store"`, { cwd: "dist", stdio: "inherit" });

console.log(`\n✓ ${zipName}`);
