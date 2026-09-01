import type { SVGProps } from "react";

/**
 * PBOS canonical icon language (V1 Visual Correction §9–§10).
 *
 * One consistent line-icon family, PBOS-OWNED source — no icon package is
 * installed. Drawn in the Lucide visual idiom (24×24 grid, single stroke,
 * round caps/joins) so the set reads as one system. Stroke ≈ 1.75, default
 * render size 18px, `currentColor` so icons inherit the surrounding text
 * colour and the canonical focus ring.
 *
 * Icons are DECORATIVE by default (`aria-hidden`): every place we use one, a
 * real text label sits beside it. Pass `title` only for a genuinely icon-only
 * control, which also needs its own `aria-label` on the control itself.
 */

export type IconName =
  | "today"
  | "focus"
  | "goals"
  | "planner"
  | "calendar"
  | "academics"
  | "development"
  | "fitness"
  | "routine"
  | "language"
  | "money"
  | "knowledge"
  | "analytics"
  | "ai"
  | "settings";

// Each entry is a list of `d` attributes rendered as <path> elements.
const PATHS: Record<IconName, string[]> = {
  // Home
  today: ["M3 10.5 12 4l9 6.5", "M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5", "M9.5 21v-6h5v6"],
  // Timer / target hybrid — a focus dial
  focus: ["M10 2h4", "M12 14l3-3", "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"],
  // Target
  goals: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z",
    "M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  ],
  // List
  planner: ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  // Calendar with day marks
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M3.5 6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
    "M3.5 10h17",
    "M8 14h.01",
    "M12 14h.01",
    "M16 14h.01",
    "M8 18h.01",
    "M12 18h.01",
  ],
  // Graduation cap
  academics: [
    "M22 10 12 5.5 2 10l10 4.5z",
    "M6 12v4.5c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7V12",
    "M22 10v5",
  ],
  // Code brackets
  development: ["M9 6 3 12l6 6", "M15 6l6 6-6 6"],
  // Activity pulse
  fitness: ["M22 12h-5l-2 6-6-14-2 8H2"],
  // Repeat
  routine: [
    "M17 2l3 3-3 3",
    "M20 5H8a4 4 0 0 0-4 4v1",
    "M7 22l-3-3 3-3",
    "M4 19h12a4 4 0 0 0 4-4v-1",
  ],
  // Languages
  language: [
    "M4 5h9",
    "M8.5 3c0 5-2.5 9-6 11",
    "M5 9c0 3 2.5 6 7 7",
    "M12 20l4.5-10L21 20",
    "M13.5 16h6",
  ],
  // Wallet
  money: [
    "M3 6a2 2 0 0 1 2-2h12v4",
    "M3 6v11a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z",
    "M16 12.5h.01",
  ],
  // Open book
  knowledge: [
    "M12 7c0-1.7-1.3-3-3-3H3v13h6c1.7 0 3 1.3 3 3",
    "M12 7c0-1.7 1.3-3 3-3h6v13h-6c-1.7 0-3 1.3-3 3",
    "M12 7v13",
  ],
  // Line chart
  analytics: ["M4 4v15a1 1 0 0 0 1 1h15", "M7 14l3-3 3 2 4-5"],
  // Restrained four-point sparkle
  ai: [
    "M12 3l1.8 4.9L18.7 10l-4.9 1.8L12 16.7l-1.8-4.9L5.3 10l4.9-1.8z",
    "M18 15l.7 1.9L20.6 18l-1.9.7L18 20.6l-.7-1.9L15.4 18z",
  ],
  // Sliders
  settings: [
    "M6 4v6",
    "M6 14v6",
    "M12 4v10",
    "M12 18v2",
    "M18 4v2",
    "M18 10v10",
    "M4 10h4",
    "M10 14h4",
    "M16 6h4",
  ],
};

export function Icon({
  name,
  size = 18,
  title,
  className,
  ...rest
}: {
  name: IconName;
  size?: number;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
