import { Outlet, useMatches } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const matches = useMatches();
  const current = matches[matches.length - 1] as { handle?: { title?: string } };
  const title = current?.handle?.title ?? "Performance Buddy OS";

  return (
    <div className="h-screen w-screen flex bg-canvas text-text-primary font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
