/**
 * V1 AI Apply adapters — now a THIN PROJECTION over the shared mutation engine
 * (`app/src/domains/mutations/`). Phase C unified the two write paths: the
 * validate/preview/apply logic for these four kinds is authored once in
 * `MUTATION_REGISTRY`; this module exposes just the subset the AI provider is
 * allowlisted to propose, under the names the V1 intelligence store, the
 * `RecommendationCard` and the V1 tests already import.
 *
 * There is still deliberately no generic `applyPatch` / `writeTable` /
 * `runCommand`. A recommendation whose `kind` is not one of the four below
 * cannot be applied through this module (`getAdapter` returns `null`), and the
 * wider registry itself fails closed on any unknown kind.
 */
import type { RecommendationKind } from "./types";
import { MUTATION_REGISTRY } from "../mutations/registry";
import type { ApplyContext, ApplyOutcome, MutationDescriptor } from "../mutations/types";

export type { ApplyContext, ApplyOutcome };

/** An Apply adapter is exactly a mutation descriptor. */
export type ApplyAdapter = MutationDescriptor;

/** The four kinds the AI provider may propose (parse-time allowlist lives in
 *  `intelligence/engine.ts` / `types.ts`; this is the Apply-time allowlist). */
const AI_APPLY_KINDS: readonly RecommendationKind[] = [
  "create-action",
  "schedule-block",
  "set-knowledge-review",
  "adjust-routine-cadence",
];

export const APPLY_ADAPTERS: Record<RecommendationKind, ApplyAdapter> = {
  "create-action": MUTATION_REGISTRY["create-action"],
  "schedule-block": MUTATION_REGISTRY["schedule-block"],
  "set-knowledge-review": MUTATION_REGISTRY["set-knowledge-review"],
  "adjust-routine-cadence": MUTATION_REGISTRY["adjust-routine-cadence"],
};

export function getAdapter(kind: string): ApplyAdapter | null {
  if (!(AI_APPLY_KINDS as readonly string[]).includes(kind)) return null;
  return APPLY_ADAPTERS[kind as RecommendationKind] ?? null;
}
