// npm run studio — Remotion Studio with every story: scrub any frame, hear the cached narration.
import { spawn } from "node:child_process";
import { prepareRemotionPublic } from "../export/remotionPublic.ts";
import { PROJECT_ROOT } from "./common.ts";

prepareRemotionPublic(PROJECT_ROOT);
const studio = spawn("npx", ["remotion", "studio", "remotion/index.ts", ...process.argv.slice(2)], { cwd: PROJECT_ROOT, stdio: "inherit" });
studio.on("exit", (code) => process.exit(code ?? 0));
