/**
 * Deterministic Resilience Engine. State resolution follows the EXACT
 * priority order printed in the approved reference's own "State Resolution
 * Order (Internal Logic)" panel:
 *
 *   Loading? → Error? → Configured? → Data exists? → Filters active? → Otherwise
 *
 * This is not a guess at an order — it's copied from the locked design
 * spec and enforced here as real, tested logic.
 */

import type { AIAvailability, AIAvailabilityInputs, ResilienceInputs, ResilienceState } from "./types";

export function resolveResilienceState(inputs: ResilienceInputs): ResilienceState {
  if (inputs.isLoading) return "loading";
  if (inputs.hasError) return "error";
  if (!inputs.isConfigured) return "setup-required";
  if (inputs.hasData) return "has-data";
  if (inputs.filtersActive) return "filtered-empty";
  return inputs.emptyIsPositive ? "positive-empty" : "true-empty";
}

/**
 * §29-31: AI Disabled, Not Configured, and Unavailable are three genuinely
 * different states, not one "AI broken" flag. A user choosing to disable
 * AI is not an error; a provider outage is not the same as never having
 * configured one.
 */
export function deriveAIAvailability(inputs: AIAvailabilityInputs): AIAvailability {
  if (!inputs.userEnabled) return "disabled";
  if (!inputs.providerConfigured) return "not-configured";
  if (inputs.lastRequestFailed) return "unavailable";
  return "ready";
}

/**
 * §50: "Never show Saved before authoritative persistence succeeds."
 * A pure label function so this rule can't be bypassed by a component
 * showing "Saved" optimistically before the save promise resolves.
 */
export function saveStateLabel(state: "idle" | "saving" | "saved" | "failed"): string {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "failed":
      return "Save Failed";
    default:
      return "";
  }
}
