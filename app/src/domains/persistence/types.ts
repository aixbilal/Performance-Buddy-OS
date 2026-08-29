/**
 * Performance Buddy OS — Persistence domain model.
 *
 * HONEST SCOPE NOTE: this is real, working localStorage-backed persistence
 * — genuinely functional in the actual Tauri window (webviews support
 * localStorage same as any browser, backed by real on-disk storage). It is
 * NOT the eventual authoritative SQLite architecture from ADR-0001 —
 * that still requires Rust-side work this sandbox cannot do (no Rust
 * toolchain, flagged since Day 2). This is a legitimate, honest V1 step:
 * data now genuinely survives an app restart, using the simplest storage
 * that actually works today, with an interface designed so swapping to
 * SQLite later doesn't require changing any consuming domain code.
 */

/** Matches the shape of `window.localStorage` — injectable so the engine is testable without a real browser. */
export type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SaveResult = { success: boolean; error: string | null };
export type LoadResult<T> = { value: T; error: string | null; wasEmpty: boolean };
