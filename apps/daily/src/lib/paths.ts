import path from "node:path";
import { DATA_DIR } from "./config";

/**
 * Absolute filesystem paths, resolved once against the process cwd.
 *
 * This lives outside config.ts because config.ts must stay free of `node:*`
 * imports — Next compiles it for the edge runtime too. Only node-runtime code
 * (the job, and the server components that read the digests) imports this.
 *
 * Absolute is not cosmetic, and DATA_DIR is relative now in every environment,
 * so this is the only thing standing between the git commands and a bug that has
 * already happened: `git clone <url> <dest>` resolves a RELATIVE dest against the
 * cwd it is handed, so the clone landed in `data/data/repo` while every later
 * command ran with cwd `./data/repo` — which did not exist, and Node reports a
 * missing cwd as `spawn git ENOENT`, i.e. as if git itself were not installed.
 */
export const DATA_PATH = path.resolve(DATA_DIR);

/** The working clone of the digest repo. */
export const REPO_PATH = path.join(DATA_PATH, "repo");
