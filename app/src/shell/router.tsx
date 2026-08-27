import { createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { PlaceholderPage } from "./PlaceholderPage";
import { TodayPage } from "../domains/performance/TodayPage";
import { GoalsOverviewPage } from "../domains/performance/GoalsOverviewPage";
import { GoalDetailPage } from "../domains/performance/GoalDetailPage";
import { SystemsOverviewPage } from "../domains/performance/SystemsOverviewPage";
import { SystemDetailPage } from "../domains/performance/SystemDetailPage";
import { NAVIGATION } from "./navigation";

// Flatten nav config into routes so every sidebar item resolves somewhere real,
// rather than maintaining a second, hand-written route list that can drift
// from the sidebar (this is the "single source of truth" fix for the
// App Shell / Today nav mismatch flagged in navigation.ts).
// "goals" is excluded here because it gets its own real route + children below.
const placeholderRoutes = NAVIGATION.flatMap((group) => group.items)
  .filter((item) => item.path !== "/" && item.id !== "goals")
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
      ...placeholderRoutes,
    ],
  },
]);
