import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Assessment, Course, CourseAttempt, Semester, Topic } from "./types";
import { calculateCGPA, calculateSGPA, calculateWeightedScore } from "./engine";
import {
  PRIOR_ACADEMIC_RECORD,
  SEED_ASSESSMENTS,
  SEED_ATTEMPTS,
  SEED_COURSES,
  SEED_SEMESTER,
  SEED_TOPICS,
} from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";
import type { SaveState } from "../resilience/types";

type AcademicContextValue = {
  semester: Semester;
  courses: Course[];
  topics: Topic[];
  assessments: Assessment[];
  attemptsByCourseId: Record<string, CourseAttempt[]>;
  getTopicsForCourse: (courseId: string) => Topic[];
  getAssessmentsForCourse: (courseId: string) => Assessment[];
  getCourseWeightedScore: (courseId: string) => number;
  setAssessmentMarks: (assessmentId: string, obtainedMarks: number) => void;
  cgpa: ReturnType<typeof calculateCGPA>;
  projectedSGPA: number | null;
  assessmentsSaveState: SaveState;
};

const AcademicContext = createContext<AcademicContextValue | null>(null);

export function AcademicProvider({ children }: { children: ReactNode }) {
  const [courses] = useState<Course[]>(SEED_COURSES);
  const [topics] = useState<Topic[]>(SEED_TOPICS);
  // Real persistence: entered marks now genuinely survive an app restart —
  // see domains/persistence for the honest scope note.
  const [assessments, setAssessments, assessmentsSaveState] = usePersistedState<Assessment[]>(
    "academic-assessments",
    SEED_ASSESSMENTS
  );
  const [attemptsByCourseId] = useState<Record<string, CourseAttempt[]>>(SEED_ATTEMPTS);

  const getTopicsForCourse = (courseId: string) =>
    topics.filter((t) => t.courseId === courseId).sort((a, b) => a.order - b.order);

  const getAssessmentsForCourse = (courseId: string) => assessments.filter((a) => a.courseId === courseId);

  const getCourseWeightedScore = (courseId: string) => {
    const courseAssessments = getAssessmentsForCourse(courseId).filter((a) => a.obtainedMarks !== null);
    return calculateWeightedScore(
      courseAssessments.map((a) => ({
        obtainedMarks: a.obtainedMarks as number,
        totalMarks: a.totalMarks,
        weightPercent: a.weightPercent,
      }))
    );
  };

  const setAssessmentMarks = (assessmentId: string, obtainedMarks: number) => {
    setAssessments(assessments.map((a) => (a.id === assessmentId ? { ...a, obtainedMarks } : a)));
  };

  // No attempts are graded yet in seed data (current semester in progress),
  // so CGPA/SGPA are correctly null right now — see engine.test.ts for the
  // verified behavior once real grades exist.
  const cgpa = calculateCGPA(courses, attemptsByCourseId, PRIOR_ACADEMIC_RECORD);
  const projectedSGPA = calculateSGPA(
    courses.map((c) => ({
      creditHours: c.creditHours,
      grade: c.projectedGrade,
    }))
  );

  const value = useMemo(
    () => ({
      semester: SEED_SEMESTER,
      courses,
      topics,
      assessments,
      attemptsByCourseId,
      getTopicsForCourse,
      getAssessmentsForCourse,
      getCourseWeightedScore,
      setAssessmentMarks,
      cgpa,
      projectedSGPA,
      assessmentsSaveState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, topics, assessments, attemptsByCourseId, assessmentsSaveState]
  );

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) throw new Error("useAcademic must be used within AcademicProvider");
  return ctx;
}
