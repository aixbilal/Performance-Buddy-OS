import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DomainPermissions, PermissionLevel, Recommendation, RecommendationStatus } from "./types";
import { computeCombinedImpact, filterRecommendationsByPermission } from "./engine";
import { CURRENT_WEEKLY_LOAD_MINUTES, DEFAULT_PERMISSIONS, SEED_RECOMMENDATIONS, WEEKLY_CAPACITY_MINUTES } from "./mockData";

type AICoachContextValue = {
  permissions: DomainPermissions;
  setPermission: (domain: string, level: PermissionLevel) => void;
  visibleRecommendations: Recommendation[];
  filteredOutCount: number;
  decideRecommendation: (id: string, status: RecommendationStatus) => void;
  combinedImpact: ReturnType<typeof computeCombinedImpact>;
  decisionHistory: Recommendation[];
};

const AICoachContext = createContext<AICoachContextValue | null>(null);

export function AICoachProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<DomainPermissions>(DEFAULT_PERMISSIONS);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(SEED_RECOMMENDATIONS);

  const setPermission = (domain: string, level: PermissionLevel) => {
    setPermissions((prev) => ({ ...prev, [domain]: level }));
  };

  // §8.8 in action: recommendations for domains without Read+Recommend are
  // filtered out here — if permissions changed to disable everything, this
  // would correctly return an empty list, not fall back to showing them anyway.
  const allowedRecommendations = filterRecommendationsByPermission(recommendations, permissions);
  const visibleRecommendations = allowedRecommendations.filter((r) => r.status === "pending");
  const decisionHistory = allowedRecommendations.filter((r) => r.status !== "pending");
  const filteredOutCount = recommendations.length - allowedRecommendations.length;

  const decideRecommendation = (id: string, status: RecommendationStatus) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r))
    );
  };

  const combinedImpact = computeCombinedImpact(CURRENT_WEEKLY_LOAD_MINUTES, allowedRecommendations, WEEKLY_CAPACITY_MINUTES);

  const value = useMemo(
    () => ({
      permissions,
      setPermission,
      visibleRecommendations,
      filteredOutCount,
      decideRecommendation,
      combinedImpact,
      decisionHistory,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissions, recommendations]
  );

  return <AICoachContext.Provider value={value}>{children}</AICoachContext.Provider>;
}

export function useAICoach() {
  const ctx = useContext(AICoachContext);
  if (!ctx) throw new Error("useAICoach must be used within AICoachProvider");
  return ctx;
}
