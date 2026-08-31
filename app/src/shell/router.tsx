import { createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { PlaceholderPage } from "./PlaceholderPage";
import { TodayPage } from "../domains/performance/TodayPage";
import { GoalsOverviewPage } from "../domains/performance/GoalsOverviewPage";
import { GoalDetailPage } from "../domains/performance/GoalDetailPage";
import { GoalBuilderPage } from "../domains/performance/GoalBuilderPage";
import { SystemsOverviewPage } from "../domains/performance/SystemsOverviewPage";
import { SystemDetailPage } from "../domains/performance/SystemDetailPage";
import { AcademicsOverviewPage } from "../domains/academic/AcademicsOverviewPage";
import { CourseDetailPage } from "../domains/academic/CourseDetailPage";
import { CourseBuilderPage } from "../domains/academic/CourseBuilderPage";
import { SgpaCgpaPage } from "../domains/academic/SgpaCgpaPage";
import { KnowledgeOverviewPage } from "../domains/knowledge/KnowledgeOverviewPage";
import { KnowledgeTopicBuilderPage } from "../domains/knowledge/KnowledgeTopicBuilderPage";
import { NotesHubPage } from "../domains/knowledge/NotesHubPage";
import { TopicDetailPage } from "../domains/knowledge/TopicDetailPage";
import { DevelopmentOverviewPage } from "../domains/development/DevelopmentOverviewPage";
import { SkillDetailPage } from "../domains/development/SkillDetailPage";
import { ProjectDetailPage } from "../domains/development/ProjectDetailPage";
import { LearningPathPage } from "../domains/development/LearningPathPage";
import {
  ProjectBuilderPage,
  SkillBuilderPage,
} from "../domains/development/DevelopmentBuilderPages";
import { FitnessOverviewPage } from "../domains/fitness-recovery/FitnessOverviewPage";
import { RecoveryReadinessPage } from "../domains/fitness-recovery/RecoveryReadinessPage";
import { PlanBuilderPage } from "../domains/fitness-recovery/PlanBuilderPage";
import { TrainingPlanDetailPage } from "../domains/fitness-recovery/TrainingPlanDetailPage";
import { ActiveWorkoutPage } from "../domains/fitness-recovery/ActiveWorkoutPage";
import { RoutinesOverviewPage } from "../domains/routine/RoutinesOverviewPage";
import { RoutineBuilderPage } from "../domains/routine/RoutineBuilderPage";
import { RoutineDetailPage } from "../domains/routine/RoutineDetailPage";
import { DailyCheckInPage } from "../domains/routine/DailyCheckInPage";
import { ReadingLanguageOverviewPage } from "../domains/language/ReadingLanguageOverviewPage";
import { PathBuilderPage, BookBuilderPage } from "../domains/language/LanguageBuilderPages";
import { LanguagePathDetailPage } from "../domains/language/LanguagePathDetailPage";
import { LearningSessionPage } from "../domains/language/LearningSessionPage";
import { BookDetailPage } from "../domains/language/BookDetailPage";
import { MoneyOverviewPage } from "../domains/money/MoneyOverviewPage";
import { TransactionsPage } from "../domains/money/TransactionsPage";
import { BudgetSavingsPage } from "../domains/money/BudgetSavingsPage";
import { MoneyInsightsPage } from "../domains/money/MoneyInsightsPage";
import { AnalyticsOverviewPage } from "../domains/analytics/AnalyticsOverviewPage";
import { AICoachPage } from "../domains/intelligence/AICoachPage";
import { PlannerPage } from "../domains/planning/PlannerPage";
import { SettingsPage } from "../domains/settings/SettingsPage";
import { OnboardingPage } from "../domains/onboarding/OnboardingPage";
import { FocusPage } from "../domains/focus/FocusPage";
import { NAVIGATION } from "./navigation";

// Flatten nav config into routes so every sidebar item resolves somewhere real,
// rather than maintaining a second, hand-written route list that can drift
// from the sidebar (this is the "single source of truth" fix for the
// App Shell / Today nav mismatch flagged in navigation.ts).
const STRUCTURED_IDS = ["goals", "academics", "knowledge", "development", "fitness", "routine", "language", "money", "analytics", "ai-coach", "calendar", "settings", "focus"];
const placeholderRoutes = NAVIGATION.flatMap((group) => group.items)
  .filter((item) => item.path !== "/" && !STRUCTURED_IDS.includes(item.id))
  .map((item) => ({
    path: item.path,
    element: <PlaceholderPage label={item.label} />,
    handle: { title: item.label },
  }));

export const router = createHashRouter([
  // Onboarding renders standalone, outside AppShell — no sidebar/topbar
  // during setup, matching real onboarding UX. Reachable at #/onboarding
  // for now; real startup-time routing into this is Day 15B's concern
  // (splash/launch sequence), not implemented here — see DAY-15A notes.
  { path: "/onboarding", element: <OnboardingPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage />, handle: { title: "Today" } },
      { path: "/goals", element: <GoalsOverviewPage />, handle: { title: "Goals" } },
      { path: "/goals/new", element: <GoalBuilderPage />, handle: { title: "Goal Builder" } },
      { path: "/goals/:goalId", element: <GoalDetailPage />, handle: { title: "Goal" } },
      { path: "/goals/:goalId/edit", element: <GoalBuilderPage />, handle: { title: "Edit Goal" } },
      { path: "/systems", element: <SystemsOverviewPage />, handle: { title: "Systems" } },
      { path: "/systems/:systemId", element: <SystemDetailPage />, handle: { title: "System" } },
      { path: "/academics", element: <AcademicsOverviewPage />, handle: { title: "Academics" } },
      { path: "/academics/new", element: <CourseBuilderPage />, handle: { title: "Add Course" } },
      { path: "/academics/sgpa-cgpa", element: <SgpaCgpaPage />, handle: { title: "SGPA / CGPA" } },
      { path: "/academics/:courseId", element: <CourseDetailPage />, handle: { title: "Course" } },
      { path: "/academics/:courseId/edit", element: <CourseBuilderPage />, handle: { title: "Edit Course" } },
      { path: "/knowledge", element: <KnowledgeOverviewPage />, handle: { title: "Knowledge" } },
      { path: "/knowledge/new", element: <KnowledgeTopicBuilderPage />, handle: { title: "Add Topic" } },
      { path: "/knowledge/notes", element: <NotesHubPage />, handle: { title: "Notes Hub" } },
      { path: "/knowledge/:topicId", element: <TopicDetailPage />, handle: { title: "Topic" } },
      { path: "/knowledge/:topicId/edit", element: <KnowledgeTopicBuilderPage />, handle: { title: "Edit Topic" } },
      { path: "/development", element: <DevelopmentOverviewPage />, handle: { title: "Development" } },
      { path: "/development/learning-path", element: <LearningPathPage />, handle: { title: "Learning Path" } },
      { path: "/development/projects/new", element: <ProjectBuilderPage />, handle: { title: "Add Project" } },
      { path: "/development/projects/:projectId", element: <ProjectDetailPage />, handle: { title: "Project" } },
      { path: "/development/projects/:projectId/edit", element: <ProjectBuilderPage />, handle: { title: "Edit Project" } },
      { path: "/development/skills/new", element: <SkillBuilderPage />, handle: { title: "Add Skill" } },
      { path: "/development/skills/:skillId", element: <SkillDetailPage />, handle: { title: "Skill" } },
      { path: "/development/skills/:skillId/edit", element: <SkillBuilderPage />, handle: { title: "Edit Skill" } },
      { path: "/fitness", element: <FitnessOverviewPage />, handle: { title: "Fitness" } },
      { path: "/fitness/recovery", element: <RecoveryReadinessPage />, handle: { title: "Recovery" } },
      { path: "/fitness/plans/new", element: <PlanBuilderPage />, handle: { title: "Create Plan" } },
      { path: "/fitness/plans/:planId", element: <TrainingPlanDetailPage />, handle: { title: "Training Plan" } },
      { path: "/fitness/plans/:planId/edit", element: <PlanBuilderPage />, handle: { title: "Edit Plan" } },
      { path: "/fitness/workout/:workoutId", element: <ActiveWorkoutPage />, handle: { title: "Active Workout" } },
      { path: "/routine", element: <RoutinesOverviewPage />, handle: { title: "Routine" } },
      { path: "/routine/new", element: <RoutineBuilderPage />, handle: { title: "New Routine" } },
      { path: "/routine/check-in", element: <DailyCheckInPage />, handle: { title: "Daily Check-In" } },
      { path: "/routine/:routineId", element: <RoutineDetailPage />, handle: { title: "Routine" } },
      { path: "/routine/:routineId/edit", element: <RoutineBuilderPage />, handle: { title: "Edit Routine" } },
      { path: "/language", element: <ReadingLanguageOverviewPage />, handle: { title: "Reading & Language" } },
      { path: "/language/paths/new", element: <PathBuilderPage />, handle: { title: "New Language Path" } },
      { path: "/language/paths/:pathId", element: <LanguagePathDetailPage />, handle: { title: "Language Path" } },
      { path: "/language/paths/:pathId/edit", element: <PathBuilderPage />, handle: { title: "Edit Path" } },
      { path: "/language/paths/:pathId/session", element: <LearningSessionPage />, handle: { title: "Learning Session" } },
      { path: "/language/books/new", element: <BookBuilderPage />, handle: { title: "Add Book" } },
      { path: "/language/books/:bookId", element: <BookDetailPage />, handle: { title: "Book" } },
      { path: "/language/books/:bookId/edit", element: <BookBuilderPage />, handle: { title: "Edit Book" } },
      { path: "/money", element: <MoneyOverviewPage />, handle: { title: "Money" } },
      { path: "/money/transactions", element: <TransactionsPage />, handle: { title: "Transactions" } },
      { path: "/money/budget", element: <BudgetSavingsPage />, handle: { title: "Budget & Savings" } },
      { path: "/money/insights", element: <MoneyInsightsPage />, handle: { title: "Money Insights" } },
      { path: "/analytics", element: <AnalyticsOverviewPage />, handle: { title: "Analytics" } },
      { path: "/ai-coach", element: <AICoachPage />, handle: { title: "AI Coach" } },
      { path: "/calendar", element: <PlannerPage />, handle: { title: "Conflict & Capacity" } },
      { path: "/settings", element: <SettingsPage />, handle: { title: "Settings" } },
      { path: "/focus", element: <FocusPage />, handle: { title: "Focus" } },
      ...placeholderRoutes,
    ],
  },
]);
