import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Book, LanguageLesson, LanguageUnit } from "./types";
import { computePathProgress, computeReadingProgress } from "./engine";
import { SEED_BOOKS, SEED_LESSONS, SEED_UNITS } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";

type LanguageContextValue = {
  units: LanguageUnit[];
  lessons: LanguageLesson[];
  books: Book[];
  getLessonsForUnit: (unitId: string) => LanguageLesson[];
  pathProgress: ReturnType<typeof computePathProgress>;
  getReadingProgress: (bookId: string) => number;
  markLessonCompleted: (lessonId: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [units] = usePersistedState<LanguageUnit[]>("language-units", SEED_UNITS);
  const [lessons, setLessons] = usePersistedState<LanguageLesson[]>("language-lessons", SEED_LESSONS);
  const [books] = usePersistedState<Book[]>("language-books", SEED_BOOKS);

  const getLessonsForUnit = (unitId: string) => lessons.filter((l) => l.unitId === unitId).sort((a, b) => a.order - b.order);
  const pathProgress = computePathProgress(lessons);
  const getReadingProgress = (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    return book ? computeReadingProgress(book) : 0;
  };
  const markLessonCompleted = (lessonId: string) => {
    setLessons(lessons.map((l) => (l.id === lessonId ? { ...l, completed: true } : l)));
  };

  const value = useMemo(
    () => ({ units, lessons, books, getLessonsForUnit, pathProgress, getReadingProgress, markLessonCompleted }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [units, lessons, books]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
