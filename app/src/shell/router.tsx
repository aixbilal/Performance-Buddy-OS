import { createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { PlaceholderPage } from "./PlaceholderPage";
import { TodayPage } from "../domains/performance/TodayPage";
import { GoalsOverviewPage } from "../domains/performance/GoalsOverviewPage";
import { GoalDetailPage } from "../domains/performance/GoalDetailPage";
import { SystemsOverviewPage } from "../domains/performance/SystemsOverviewPage";
import { SystemDetailPage } from "../domains/performance/SystemDetailPage";
import { AcademicsOverviewPage } from "../domains/academic/AcademicsOverviewPage";
import { CourseDetailPage } from "../domains/academic/CourseDetailPage";
import { SgpaCgpaPage } from "../domains/academic/SgpaCgpaPage";
import { KnowledgeOverviewPage } from "../domains/knowledge/KnowledgeOverviewPage";
import { TopicDetailPage } from "../domains/knowledge/TopicDetailPage";
import { DevelopmentOverviewPage } from "../domains/development/DevelopmentOverviewPage";
import { SkillDetailPage } from "../domains/development/SkillDetailPage";
import { FitnessOverviewPage } from "../domains/fitness-recovery/FitnessOverviewPage";
import { RecoveryReadinessPage } from "../domains/fitness-recovery/RecoveryReadinessPage";
import { RoutinesOverviewPage } from "../domains/routine/RoutinesOverviewPage";
import { ReadingLanguageOverviewPage } from "../domains/language/ReadingLanguageOverviewPage";
import { MoneyOverviewPage } from "../domains/money/MoneyOverviewPage";
import { AnalyticsOverviewPage } from "../domains/analytics/AnalyticsOverviewPage";
import { NAVIGATION } from "./navigation";

// Flatten nav config into routes so every sidebar item resolves somewhere real,
// rather than maintaining a second, hand-written route list that can drift
// from the sidebar (this is the "single source of truth" fix for the
// App Shell / Today nav mismatch flagged in navigation.ts).
const STRUCTURED_IDS = ["goals", "academics", "knowledge", "development", "fitness", "routine", "language", "money", "analytics"];
const placeholderRoutes = NAVIGATION.flatMap((group) => group.items)
  .filter((item) => item.path !== "/" && !STRUCTURED_IDS.includes(item.id))
  .map((item) => ({
    path: item.path,
    element: <PlaceholderPage label={item.label} />,
    handle: { title: item.label },
  }));

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage />, handle: { title: "Today" } },
      { path: "/goals", element: <GoalsOverviewPage />, handle: { title: "Goals" } },
      { path: "/goals/:goalId", element: <GoalDetailPage />, handle: { title: "Goal" } },
      { path: "/systems", element: <SystemsOverviewPage />, handle: { title: "Systems" } },
      { path: "/systems/:systemId", element: <SystemDetailPage />, handle: { title: "System" } },
      { path: "/academics", element: <AcademicsOverviewPage />, handle: { title: "Academics" } },
      { path: "/academics/sgpa-cgpa", element: <SgpaCgpaPage />, handle: { title: "SGPA / CGPA" } },
      { path: "/academics/:courseId", element: <CourseDetailPage />, handle: { title: "Course" } },
      { path: "/knowledge", element: <KnowledgeOverviewPage />, handle: { title: "Knowledge" } },
      { path: "/knowledge/:topicId", element: <TopicDetailPage />, handle: { title: "Topic" } },
      { path: "/development", element: <DevelopmentOverviewPage />, handle: { title: "Development" } },
      { path: "/development/skills/:skillId", element: <SkillDetailPage />, handle: { title: "Skill" } },
      { path: "/fitness", element: <FitnessOverviewPage />, handle: { title: "Fitness" } },
      { path: "/fitness/recovery", element: <RecoveryReadinessPage />, handle: { title: "Recovery" } },
      { path: "/routine", element: <RoutinesOverviewPage />, handle: { title: "Routine" } },
      { path: "/language", element: <ReadingLanguageOverviewPage />, handle: { title: "Language" } },
      { path: "/money", element: <MoneyOverviewPage />, handle: { title: "Money" } },
      { path: "/analytics", element: <AnalyticsOverviewPage />, handle: { title: "Analytics" } },
      ...placeholderRoutes,
    ],
  },
]);
