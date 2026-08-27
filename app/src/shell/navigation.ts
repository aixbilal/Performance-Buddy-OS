/**
 * Navigation structure — single source of truth for Sidebar + Router.
 *
 * FLAG: UI ↔ ARCHITECTURE REVIEW REQUIRED (carried over from Day 1)
 * App-Shell-v1-PRIMARY.png and Today-v1-PRIMARY.png use two different sidebar
 * groupings and section labels, and Today includes a "Calendar" item that
 * App Shell does not. Neither reference is more "official" than the other.
 *
 * DECISION TAKEN HERE (provisional, not a redesign): merged into one structure,
 * used as Today's version as the base (more complete — includes Calendar) with
 * App Shell's section labels normalized to match. This is a code-level
 * necessity — routing needs exactly one structure to exist. It is NOT a UI
 * decision and should be confirmed or corrected explicitly on the design side,
 * not silently accepted because code now assumes it.
 */

export type NavItem = {
  id: string;
  label: string;
  path: string;
  status: "placeholder" | "structured" | "implemented";
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAVIGATION: NavGroup[] = [
  {
    id: "core",
    label: "Today",
    items: [
      { id: "today", label: "Today", path: "/", status: "structured" },
      { id: "focus", label: "Focus", path: "/focus", status: "placeholder" },
      { id: "goals", label: "Goals", path: "/goals", status: "placeholder" },
      { id: "calendar", label: "Calendar", path: "/calendar", status: "placeholder" },
    ],
  },
  {
    id: "life",
    label: "Life",
    items: [
      { id: "academics", label: "Academics", path: "/academics", status: "placeholder" },
      { id: "development", label: "Development", path: "/development", status: "placeholder" },
      { id: "fitness", label: "Fitness", path: "/fitness", status: "placeholder" },
      { id: "routine", label: "Routine", path: "/routine", status: "placeholder" },
      { id: "language", label: "Language", path: "/language", status: "placeholder" },
      { id: "money", label: "Money", path: "/money", status: "placeholder" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "knowledge", label: "Knowledge", path: "/knowledge", status: "placeholder" },
      { id: "analytics", label: "Analytics", path: "/analytics", status: "placeholder" },
      { id: "ai-coach", label: "AI Coach", path: "/ai-coach", status: "placeholder" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ id: "settings", label: "Settings", path: "/settings", status: "placeholder" }],
  },
];
