import type { Assessment, Course, CourseAttempt, Semester, Topic } from "./types";

/** Values below match PBOS-Academic-SGPA-CGPA and PBOS-Academic-Course-Detail approved references. */

export const SEED_SEMESTER: Semester = {
  id: "sem-3",
  label: "Semester 3 - Fall 2026",
  courseIds: ["dsa", "oop", "calc"],
};

export const SEED_COURSES: Course[] = [
  {
    id: "dsa",
    code: "CSE 201",
    title: "Data Structures",
    creditHours: 4,
    semesterId: "sem-3",
    professorName: "Prof. Neeraj Sharma",
    status: "at-risk",
    targetGrade: "A-",
    projectedGrade: "B+",
  },
  {
    id: "oop",
    code: "CSE 205",
    title: "Object Oriented Prog.",
    creditHours: 4,
    semesterId: "sem-3",
    professorName: "Staff",
    status: "on-track",
    targetGrade: "A",
    projectedGrade: "A-",
  },
  {
    id: "calc",
    code: "MTH 210",
    title: "Calculus & Analytic Geo.",
    creditHours: 3,
    semesterId: "sem-3",
    professorName: "Staff",
    status: "at-risk",
    targetGrade: "B+",
    projectedGrade: "B",
  },
];

export const SEED_ATTEMPTS: Record<string, CourseAttempt[]> = {
  dsa: [{ id: "att-dsa-1", courseId: "dsa", attemptNumber: 1, term: "Fall 2026", finalGrade: null }],
  oop: [{ id: "att-oop-1", courseId: "oop", attemptNumber: 1, term: "Fall 2026", finalGrade: null }],
  calc: [{ id: "att-calc-1", courseId: "calc", attemptNumber: 1, term: "Fall 2026", finalGrade: null }],
};

// Topic-level Professor / Personal / Mastery split, matching Course Detail reference.
export const SEED_TOPICS: Topic[] = [
  { id: "t1", courseId: "dsa", title: "Arrays", order: 1, professorCoverage: "taught", personalStudyPercent: 100, masteryPercent: 80 },
  { id: "t2", courseId: "dsa", title: "Linked Lists", order: 2, professorCoverage: "taught", personalStudyPercent: 60, masteryPercent: 55 },
  { id: "t3", courseId: "dsa", title: "Stacks", order: 3, professorCoverage: "taught", personalStudyPercent: 100, masteryPercent: 85 },
  { id: "t4", courseId: "dsa", title: "Queues", order: 4, professorCoverage: "taught", personalStudyPercent: 75, masteryPercent: 70 },
  { id: "t5", courseId: "dsa", title: "Trees", order: 5, professorCoverage: "taught", personalStudyPercent: 30, masteryPercent: 35 },
  { id: "t6", courseId: "dsa", title: "Binary Search Trees", order: 6, professorCoverage: "not-taught", personalStudyPercent: 0, masteryPercent: 0 },
];

// Prior semesters, already settled before this app existed — matches the
// approved reference's "Current CGPA 2.64 after 2 Semesters (45 Credit Hours)".
// This is NOT modeled at individual course level (those courses aren't part
// of the live Academic OS UI) — it's a single settled aggregate, same as a
// real transcript import would provide.
export const PRIOR_ACADEMIC_RECORD = { credits: 45, points: 2.64 * 45 };

export const SEED_ASSESSMENTS: Assessment[] = [
  { id: "as1", courseId: "dsa", category: "quiz", title: "Quiz 1", obtainedMarks: 18, totalMarks: 20, weightPercent: 10, date: "2026-04-10" },
  { id: "as2", courseId: "dsa", category: "quiz", title: "Quiz 2", obtainedMarks: 15, totalMarks: 20, weightPercent: 10, date: "2026-04-24" },
  { id: "as3", courseId: "dsa", category: "quiz", title: "Quiz 3 (Upcoming)", obtainedMarks: null, totalMarks: 20, weightPercent: 10, date: "2026-05-20" },
  { id: "as4", courseId: "dsa", category: "assignment", title: "Assignment 1", obtainedMarks: 18, totalMarks: 20, weightPercent: 10, date: "2026-05-02" },
  { id: "as5", courseId: "dsa", category: "lab", title: "Lab 1", obtainedMarks: 19, totalMarks: 20, weightPercent: 10, date: "2026-05-09" },
  { id: "as6", courseId: "dsa", category: "midterm", title: "Midterm Exam", obtainedMarks: null, totalMarks: 100, weightPercent: 25, date: "2026-06-05" },
  { id: "as7", courseId: "dsa", category: "final", title: "Final Exam", obtainedMarks: null, totalMarks: 100, weightPercent: 25, date: "2026-06-18" },
];
