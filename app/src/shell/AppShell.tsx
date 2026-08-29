import { Outlet, useMatches } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { ConnectivityBanner } from "./ConnectivityBanner";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

export function AppShell() {
  const matches = useMatches();
  const current = matches[matches.length - 1] as { handle?: { title?: string } };
  const title = current?.handle?.title ?? "Performance Buddy OS";

  return (
    <div className="h-screen w-screen flex bg-canvas text-text-primary font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ConnectivityBanner />
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          {/* §34: the smallest reasonable failing surface — a crash inside
              one routed page never takes down the sidebar/topbar/shell. */}
          <RouteErrorBoundary label={title} key={title}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
