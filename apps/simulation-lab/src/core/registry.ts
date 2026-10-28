import { queueExperiment } from "../experiments/queue/index.ts";
import type { AnyExperiment } from "./experiment.ts";

/** Add new experiments here. Ids are what `--experiment` and story `"experiment"` refer to. */
export const experiments: Record<string, AnyExperiment> = {
  [queueExperiment.id]: queueExperiment,
};

export function getExperiment(id: string): AnyExperiment {
  const experiment = experiments[id];
  if (!experiment) throw new Error(`Unknown experiment "${id}". Available: ${Object.keys(experiments).join(", ")}`);
  return experiment;
}
