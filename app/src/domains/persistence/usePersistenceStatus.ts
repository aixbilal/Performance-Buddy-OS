import { getPersistenceStatus, type PersistenceStatus } from "./bootstrap";

/**
 * Read the settled persistence bootstrap status (backend in use, schema
 * version, one-time migration outcome, whether we're degraded). Resolved
 * before the React tree renders, so this is a plain read — no subscription.
 *
 * Use it to show the user the *truth* about where their data lives, never a
 * fake "all good".
 */
export function usePersistenceStatus(): PersistenceStatus {
  return getPersistenceStatus();
}
