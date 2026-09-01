/**
 * Assembles the live `MutationContext` from the canonical domain stores + the
 * Phase-B adaptive repos. One hook so every consumer of the shared mutation
 * engine (Natural Capture, AI Coach, the adaptive engines) sends the same
 * context and never hand-rolls a partial one.
 *
 * Must be used inside every domain provider — `App.tsx` nests `CaptureProvider`
 * (and the AI Coach surfaces) below all of them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePerformance } from "../performance/store";
import { usePlanning } from "../planning/store";
import { useKnowledge } from "../knowledge/store";
import { useRoutine } from "../routine/store";
import { useMoney } from "../money/store";
import { useAcademic } from "../academic/store";
import { useLanguage } from "../language/store";
import { makeTodayStateRepo } from "../adaptive/repo";
import type { TodayCapacityLevel, TodayOperatingState } from "../adaptive/types";
import type { MutationContext } from "./types";

export function useMutationContext(): MutationContext {
  const perf = usePerformance();
  const planning = usePlanning();
  const knowledge = useKnowledge();
  const routine = useRoutine();
  const money = useMoney();
  const academic = useAcademic();
  const language = useLanguage();

  const todayRepo = useRef(makeTodayStateRepo());
  const [todayStates, setTodayStates] = useState<TodayOperatingState[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const states = await todayRepo.current.load();
        if (!cancelled) setTodayStates(states);
      } catch {
        /* deterministic core still works with an empty cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Assessment scope is owned by the academic store (one cache, same-course
  // guard). The mutation `update-assessment-scope` calls straight through it.
  const scopeTopicIds = useCallback(
    (assessmentId: string) => academic.getAssessmentScopeTopicIds(assessmentId),
    [academic],
  );
  const setAssessmentScope = useCallback(
    async (assessmentId: string, topicIds: string[], source: string, _now: string) => {
      void _now;
      await academic.setAssessmentScope(assessmentId, topicIds, source);
    },
    [academic],
  );

  const getCapacity = useCallback(
    (date: string): TodayCapacityLevel | null =>
      todayStates.find((s) => s.date === date)?.capacityLevel ?? null,
    [todayStates],
  );
  const setCapacity = useCallback(async (state: TodayOperatingState) => {
    await todayRepo.current.set(state);
    setTodayStates((prev) => [...prev.filter((s) => s.date !== state.date), state]);
  }, []);

  return useMemo<MutationContext>(
    () => ({
      performance: { systems: perf.systems, createAction: perf.createAction },
      planning: {
        blocks: planning.blocks,
        capacity: planning.capacity,
        checkFit: planning.checkFit,
        createBlock: planning.createBlock,
      },
      knowledge: {
        topics: knowledge.topics.map((t) => ({
          id: t.id,
          title: t.title,
          nextReviewDate: t.nextReviewDate,
          lastStudied: t.lastStudied,
        })),
        updateReviewState: knowledge.updateReviewState,
      },
      routine: {
        routines: routine.routines,
        updateRoutine: routine.updateRoutine,
        checkInRoutine: routine.checkInRoutine,
      },
      money: {
        categories: money.categoryTotals.map((c) => c.category),
        createTransaction: money.createTransaction,
      },
      academic: {
        courses: academic.courses.map((c) => ({ id: c.id, title: c.title, code: c.code })),
        topics: academic.topics.map((t) => ({
          id: t.id,
          courseId: t.courseId,
          title: t.title,
          professorCoverage: t.professorCoverage,
          personalStudyPercent: t.personalStudyPercent,
        })),
        assessments: academic.assessments.map((a) => ({
          id: a.id,
          courseId: a.courseId,
          title: a.title,
          category: a.category,
          obtainedMarks: a.obtainedMarks,
          totalMarks: a.totalMarks,
          weightPercent: a.weightPercent,
          date: a.date,
        })),
        setProfessorCoverage: academic.setProfessorCoverage,
        setPersonalStudyCoverage: academic.setPersonalStudyCoverage,
        createAssessment: academic.createAssessment,
        updateAssessment: academic.updateAssessment,
        scopeTopicIds,
        setAssessmentScope,
      },
      language: {
        paths: language.paths.map((p) => ({ id: p.id, language: p.language, title: p.title })),
        logSession: language.logSession,
      },
      today: { getCapacity, setCapacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      perf.systems,
      planning.blocks,
      planning.capacity,
      knowledge.topics,
      routine.routines,
      money.categoryTotals,
      academic.courses,
      academic.topics,
      academic.assessments,
      scopeTopicIds,
      setAssessmentScope,
      getCapacity,
      setCapacity,
    ],
  );
}
