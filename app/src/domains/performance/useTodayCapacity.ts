/**
 * Subjective daily operating capacity for Today (V2 Phase G, schema v11).
 *
 * The ONLY Today slice that is persisted. Default (no row) reads as Normal —
 * never inferred from the clock. Setting it writes `today_operating_state`
 * (source 'user'); an approved Natural Capture writes it as 'capture-approved'
 * through the shared `set-today-capacity` mutation. It does NOT touch the
 * persistent Planner capacity.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { makeTodayStateRepo, type TodayStateRepo } from "../adaptive/repo";
import { DEFAULT_TODAY_CAPACITY, type TodayCapacityLevel } from "../adaptive/types";

export function useTodayCapacity(iso: string) {
  const repoRef = useRef<TodayStateRepo>(makeTodayStateRepo());
  const [level, setLevelState] = useState<TodayCapacityLevel>(DEFAULT_TODAY_CAPACITY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await repoRef.current.get(iso);
        if (!cancelled) setLevelState(row?.capacityLevel ?? DEFAULT_TODAY_CAPACITY);
      } catch {
        /* default Normal — the deterministic engine still works */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [iso]);

  const setLevel = useCallback(
    async (next: TodayCapacityLevel, note = "") => {
      const now = new Date().toISOString();
      setLevelState(next);
      await repoRef.current.set({
        date: iso,
        capacityLevel: next,
        source: "user",
        note,
        createdAt: now,
        updatedAt: now,
      });
    },
    [iso],
  );

  return { level, setLevel, loaded, isDefault: level === DEFAULT_TODAY_CAPACITY };
}
