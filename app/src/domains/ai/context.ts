/**
 * Deterministic context assembly (docs 24.03, 30.05).
 *
 * The model receives ONLY: (a) domains the active task asked for, INTERSECTED
 * with (b) domains the user granted at least `read`. Cross-domain context is the
 * INTERSECTION of source permissions, never the union. Missing permission yields
 * a narrower context, never fabricated data.
 */

import type { ContextManifest } from "./types";

export type PermissionLevel = "no-access" | "read" | "read-recommend";
export type DomainPermissions = Record<string, PermissionLevel>;

/** The domain labels the permission model and context assembly both use. */
export const AI_DOMAINS = [
  "Today",
  "Academics",
  "Goals & Systems",
  "Knowledge",
  "Development",
  "Fitness & Recovery",
  "Routines",
  "Reading & Language",
  "Planning",
  "Money",
] as const;

export function permissionLevel(
  domain: string,
  permissions: DomainPermissions,
): PermissionLevel {
  return permissions[domain] ?? "no-access";
}

/** read OR read-recommend — enough to appear in context. */
export function canReadDomain(domain: string, permissions: DomainPermissions): boolean {
  const l = permissionLevel(domain, permissions);
  return l === "read" || l === "read-recommend";
}

/** read-recommend specifically — Read alone is not enough to receive a proposal. */
export function canRecommendForDomain(
  domain: string,
  permissions: DomainPermissions,
): boolean {
  return permissionLevel(domain, permissions) === "read-recommend";
}

/**
 * Build the manifest that will actually be sent. `requestedDomains` is what the
 * task needs; only the permitted subset is included, and every other known
 * domain is listed explicitly as excluded so the user can see the boundary.
 */
export function buildContextManifest(
  requestedDomains: string[],
  permissions: DomainPermissions,
  domainFacts: Record<string, string[]>,
): ContextManifest {
  const requested = new Set(requestedDomains);
  const included = AI_DOMAINS.filter(
    (d) => requested.has(d) && canReadDomain(d, permissions),
  );
  const excluded = AI_DOMAINS.filter((d) => !included.includes(d));
  const facts = included.flatMap((d) => (domainFacts[d] ?? []).map((f) => `[${d}] ${f}`));
  return {
    includedDomains: [...included],
    excludedDomains: [...excluded],
    facts,
  };
}

/** A calm, human-readable preview of what will be sent (docs §37 — never raw JSON). */
export function describeContextManifest(m: ContextManifest): {
  included: string[];
  excluded: string[];
} {
  return {
    included:
      m.facts.length > 0
        ? m.facts
        : m.includedDomains.map((d) => `${d}: no notable facts this window`),
    excluded: m.excludedDomains,
  };
}
