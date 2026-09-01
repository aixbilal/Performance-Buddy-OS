import type { ComponentType } from "react";
import { useMatches } from "react-router-dom";

/**
 * §19 App Shell — context rail.
 *
 * A route opts in by putting a component on its `handle.contextRail`. The rail
 * shows contextual, secondary information/actions for the CURRENT screen — it
 * is not a second navigation column and not a generic dashboard. Routes that
 * supply nothing get no rail at all (no reserved width), per the decision that
 * "if a screen has no useful context, the rail may hide".
 */
export type ContextRailComponent = ComponentType;

type RailHandle = { contextRail?: ContextRailComponent };

export function useContextRail(): ContextRailComponent | null {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle as RailHandle | undefined;
    if (handle?.contextRail) return handle.contextRail;
  }
  return null;
}

export function ContextRail({ body: Body }: { body: ContextRailComponent }) {
  return (
    <aside
      aria-label="Context"
      className="hidden lg:flex w-[300px] shrink-0 flex-col border-l border-border-subtle bg-canvas overflow-y-auto"
    >
      <div className="h-16 shrink-0 flex items-center px-5 border-b border-border-subtle">
        <span className="t-label uppercase text-text-muted">Context</span>
      </div>
      <div className="flex-1 p-5 space-y-4">
        <Body />
      </div>
    </aside>
  );
}
