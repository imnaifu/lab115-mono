// Remotion Studio / CLI settings. The CLI renderer (src/cli/render.ts) passes the same values.
import { Config } from "@remotion/cli/config";

// remotion/public links to the Soco-st assets (public/assets) and the voice cache (cache/);
// see src/export/remotionPublic.ts.
Config.setPublicDir("remotion/public");
Config.setEntryPoint("remotion/index.ts");
