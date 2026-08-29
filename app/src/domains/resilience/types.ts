/**
 * Performance Buddy OS — Resilience & Edge States domain model.
 *
 * Per Day 17 Handoff §24: "EMPTY ≠ LOADING ≠ OFFLINE ≠ ERROR ≠ DISABLED ≠
 * NOT CONFIGURED ≠ PARTIAL." Every state below is a distinct, real value —
 * never collapsed into a single "isEmpty" boolean, per the approved
 * reference's own "Key Notes": "Unknown ≠ Zero. Empty ≠ Loading. Empty ≠
 * Error. Empty ≠ Disabled. Empty ≠ Not Configured."
 */

export type ResilienceState =
  | "loading"
  | "error"
  | "setup-required"
  | "has-data"
  | "filtered-empty"
  | "true-empty"
  | "positive-empty";

export type ResilienceInputs = {
  isLoading: boolean;
  hasError: boolean;
  isConfigured: boolean;
  hasData: boolean;
  filtersActive: boolean;
  /** Some domains (Capture Inbox, "all caught up") treat zero as a GOOD outcome, not a call-to-action. */
  emptyIsPositive: boolean;
};

export type AIAvailability = "ready" | "disabled" | "not-configured" | "unavailable";

export type AIAvailabilityInputs = {
  userEnabled: boolean;
  providerConfigured: boolean;
  lastRequestFailed: boolean;
};

export type SaveState = "idle" | "saving" | "saved" | "failed";
