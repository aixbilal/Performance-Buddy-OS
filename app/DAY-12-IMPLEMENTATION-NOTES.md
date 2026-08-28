# Day 12 — AI Coach & Intelligence — Changelog

**Built** (in the existing `intelligence` domain from Day 2 — no new folder)
- `PermissionLevel`/`Recommendation`/`CombinedImpactResult` types.
- `filterContextByPermission` — enforces §8.10 (context minimization) and
  §8.9 (no-access domains never leak into a request).
- `canRecommendForDomain` / `filterRecommendationsByPermission` — the
  concrete proof of **§8.8: "AI is allowed to recommend nothing."** A
  Money-domain candidate (matching your own reference's example) is filtered
  out entirely when Money is set to No Access — not hidden in the UI, never
  generated in the first place.
- `computeCombinedImpact` — §8.7's combined-validation rule: sums only
  accepted/modified recommendations against weekly capacity, correctly
  ignoring pending/rejected ones.
- `AICoachPage` — live permission grid (Money defaults to No Access, matching
  your reference), a real Accept/Modify/Reject queue, combined capacity
  check, and decision history — reuses the Day 2 `ProposalCard` pattern's
  underlying idea rather than inventing a second one.

**What this explicitly does NOT do**
No real external AI provider is wired — no API key handling exists in this
build. The `Recommendation` seed data stands in for what a real AI call
would eventually produce; every deterministic stage around it (permissions,
filtering, combined validation, decision lifecycle) is real and tested. This
matches the Handoff's own instruction not to implement "unrestricted AI
writes" or provider routing at this stage.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **9/9 new, 81/81 total** across all 9 domains
- `npm run build` — clean
- `npm run lint` — 0 errors, 11 known harmless warnings

**Deferred, not forgotten**
- AI Workspace (conversational interface, natural-language capture →
  structured proposal) — a real chat UI is significant standalone work;
  the proposal/decision architecture it would produce output into already
  exists and is tested
- Persistent AI memory / saved preferences (§8.12) — no memory store yet
- Real conflict detection between recommendations (the reference's "1
  schedule conflict" panel) — depends on Day 13's actual scheduling model,
  which doesn't exist yet; combined *capacity* validation is real, combined
  *conflict* detection is not

**Next:** Day 13 — Planning & Calendar — the last day of the addendum.
Fixed vs flexible commitments, capacity validation for real (this domain's
minimal version gets superseded by Day 13's actual Capacity Service), and
"Could Not Fit" as a valid planner outcome.
