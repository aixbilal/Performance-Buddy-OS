/**
 * The shared explicit mutation engine (V2 Phase C).
 *
 * One validated path from a structured proposal to exactly one canonical domain
 * operation. Used by the AI Coach (via `intelligence/applyAdapters`), by Natural
 * Capture (Phase D), and by the adaptive engines (Phases E–G).
 */
export * from "./types";
export {
  MUTATION_REGISTRY,
  MUTATION_KINDS,
  getMutation,
  runMutation,
  isMutationKind,
} from "./registry";
