// npm run assets [-- --strict]
// Checks config/assets.socost.json against the files in public/assets/socost/: unfilled slots,
// missing files, files nobody references, entries without a source link. Exit 1 with --strict.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseManifest } from "../assets/manifest.ts";
import { PROJECT_ROOT, readJson, runCli } from "./common.ts";

runCli(async () => {
  const { values } = parseArgs({ options: { strict: { type: "boolean", default: false } } });
  const manifest = parseManifest(readJson(join(PROJECT_ROOT, "config", "assets.socost.json")));
  const dir = join(PROJECT_ROOT, manifest.dir);
  const present = existsSync(dir) ? readdirSync(dir).filter((file) => /\.(svg|png)$/i.test(file)) : [];
  const referenced = new Set(manifest.assets.map((entry) => entry.file).filter(Boolean));

  console.log(`${manifest.library} assets · terms: ${manifest.terms}`);
  console.log(`folder: ${manifest.dir} (${present.length} image files)\n`);
  let problems = 0;
  for (const entry of manifest.assets) {
    let status: string;
    if (!entry.file) status = "slot empty — placeholder used";
    else if (!present.includes(entry.file)) status = `MISSING FILE ${entry.file}`;
    else status = `ok  ${entry.file}`;
    const noSource = entry.file && !entry.source ? "  (add the source page URL)" : "";
    if (!status.startsWith("ok") || noSource) problems++;
    console.log(`  ${entry.id.padEnd(18)} ${entry.kind.padEnd(10)} ${entry.role.padEnd(18)} ${status}${noSource}`);
  }
  const unlisted = present.filter((file) => !referenced.has(file));
  if (unlisted.length > 0) {
    console.log(`\nFiles in the folder that no entry uses (add them to the manifest or remove them):`);
    for (const file of unlisted) console.log(`  ${file}`);
  }
  console.log(`\nRules: ${manifest.rules.join(" ")}`);
  console.log(problems === 0 ? "\nAll slots filled." : `\n${problems} item(s) need attention; placeholders are drawn for empty or missing slots.`);
  if (values.strict && (problems > 0 || unlisted.length > 0)) process.exitCode = 1;
});
