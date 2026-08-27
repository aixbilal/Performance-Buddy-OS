import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Evidence, Source, Topic } from "./types";
import { deriveKnowledgeState, isReviewDue } from "./engine";
import { SEED_EVIDENCE, SEED_SOURCES, SEED_TOPICS } from "./mockData";

type KnowledgeContextValue = {
  topics: Topic[];
  getSourcesForTopic: (topicId: string) => Source[];
  getEvidenceForTopic: (topicId: string) => Evidence[];
  getTopicState: (topic: Topic) => ReturnType<typeof deriveKnowledgeState>;
  getReviewQueue: () => Topic[];
  addEvidence: (topicId: string, evidence: Omit<Evidence, "id" | "topicId">) => void;
};

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [topics] = useState<Topic[]>(SEED_TOPICS);
  const [sources] = useState<Source[]>(SEED_SOURCES);
  const [evidence, setEvidence] = useState<Evidence[]>(SEED_EVIDENCE);

  const getSourcesForTopic = (topicId: string) => sources.filter((s) => s.topicId === topicId);
  const getEvidenceForTopic = (topicId: string) =>
    evidence.filter((e) => e.topicId === topicId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getTopicState = (topic: Topic) => deriveKnowledgeState(topic.masteryPercent);

  // A topic can be Strong AND Review Due at once — never collapsed into one flag, per Master Handoff §5.
  const getReviewQueue = () => topics.filter((t) => isReviewDue(t.nextReviewDate));

  const addEvidence = (topicId: string, newEvidence: Omit<Evidence, "id" | "topicId">) => {
    setEvidence((prev) => [
      ...prev,
      { ...newEvidence, id: `ev-${Date.now()}`, topicId },
    ]);
  };

  const value = useMemo(
    () => ({
      topics,
      getSourcesForTopic,
      getEvidenceForTopic,
      getTopicState,
      getReviewQueue,
      addEvidence,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, sources, evidence]
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error("useKnowledge must be used within KnowledgeProvider");
  return ctx;
}
