/**
 * V2 ADAPTIVE INTELLIGENCE persistence foundation (schema v11).
 *
 * Durable slices only — Capture Proposals, Assessment↔Topic scope, Action
 * scheduling constraints, recurring occurrence exceptions, Planning change sets
 * (the durable Planning Diff), and the subjective Today operating state. The
 * engines, shared mutation registry and UI that consume these land in later V2
 * phases (blueprint 07 §18, Phases C–J).
 */
export * from "./types";
export * from "./repo";
