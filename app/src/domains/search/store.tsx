import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SearchResult } from "./types";
import { rankResults } from "./engine";
import { usePerformance } from "../performance/store";
import { useAcademic } from "../academic/store";
import { useKnowledge } from "../knowledge/store";
import { useDevelopment } from "../development/store";
import { useRoutine } from "../routine/store";
import { useObsidian } from "../obsidian/store";

const MAX_RECENTS = 15;

type SearchContextValue = {
  search: (query: string, contextDomain?: string | null) => ReturnType<typeof rankResults>;
  recordRecent: (id: string) => void;
  recentIds: string[];
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const { goals, systems } = usePerformance();
  const { courses } = useAcademic();
  const { topics } = useKnowledge();
  const { skills } = useDevelopment();
  const { routines } = useRoutine();
  const { notes } = useObsidian();

  // §10: this index is built FRESH from real domain state every render — it
  // is never stored as a second authoritative copy. If any of these stores
  // change, the index is simply recomputed, proving it's genuinely derived.
  const buildIndex = (): SearchResult[] => [
    ...goals.map((g) => ({
      id: g.id,
      entityType: "goal" as const,
      title: g.title,
      subtitle: g.domain,
      domain: "Goals",
      canonicalRoute: `/goals/${g.id}`,
      keywords: [g.domain, g.lifecycle, g.type],
      updatedAt: g.deadline ?? "",
    })),
    ...systems.map((s) => ({
      id: s.id,
      entityType: "system" as const,
      title: s.title,
      subtitle: s.description,
      domain: "Systems",
      canonicalRoute: `/systems/${s.id}`,
      keywords: s.tags,
      updatedAt: "",
    })),
    ...courses.map((c) => ({
      id: c.id,
      entityType: "course" as const,
      title: c.title,
      subtitle: c.code,
      domain: "Academics",
      canonicalRoute: `/academics/${c.id}`,
      keywords: [c.code, c.professorName],
      updatedAt: "",
    })),
    ...topics.map((t) => ({
      id: t.id,
      entityType: "knowledge-topic" as const,
      title: t.title,
      subtitle: t.context,
      domain: "Knowledge",
      canonicalRoute: `/knowledge/${t.id}`,
      keywords: [t.category, t.context],
      updatedAt: t.lastStudied ?? "",
    })),
    ...skills.map((s) => ({
      id: s.id,
      entityType: "skill" as const,
      title: s.title,
      subtitle: s.category,
      domain: "Development",
      canonicalRoute: `/development/skills/${s.id}`,
      keywords: [s.category],
      updatedAt: "",
    })),
    ...routines.map((r) => ({
      id: r.id,
      entityType: "routine" as const,
      title: r.title,
      subtitle: r.category,
      domain: "Routines",
      canonicalRoute: `/routine`,
      keywords: [r.category, r.timeWindow],
      updatedAt: "",
    })),
    // Obsidian note METADATA only (docs 16.09) — no note bodies are indexed.
    ...notes.map((n) => ({
      id: n.id,
      entityType: "note" as const,
      title: n.title,
      subtitle: n.relativePath,
      domain: "Notes",
      canonicalRoute: `/knowledge/notes`,
      keywords: [n.filename, n.relativePath, n.existsOnDisk ? "" : "stale"],
      updatedAt: n.indexedAt,
    })),
    {
      id: "page-settings",
      entityType: "setting-page" as const,
      title: "Settings",
      subtitle: "App configuration",
      domain: "Settings",
      canonicalRoute: "/settings",
      keywords: ["preferences", "configuration"],
      updatedAt: "",
    },
  ];

  const search = (query: string, contextDomain: string | null = null) => {
    const index = buildIndex(); // rebuilt every call — cheap proof it's derived, not cached authoritative state
    return rankResults(query, index, recentIds, contextDomain);
  };

  const recordRecent = (id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENTS));
  };

  const value = useMemo(
    () => ({ search, recordRecent, recentIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, systems, courses, topics, skills, routines, notes, recentIds]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}
