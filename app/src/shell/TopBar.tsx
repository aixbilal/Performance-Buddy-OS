export function TopBar({ title }: { title: string }) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border-subtle bg-canvas">
      <div className="flex items-center gap-4">
        <h1 className="text-text-primary text-base font-semibold">{title}</h1>
        <span className="text-text-muted text-sm">{today}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-inset border border-border-subtle text-text-muted text-sm w-72">
          <span>Search or command…</span>
          <kbd className="ml-auto text-[10px] text-text-disabled">⌘K</kbd>
        </div>
        <button className="px-3 py-1.5 rounded-md bg-ai-surface border border-border-focus text-text-primary text-sm flex items-center gap-1.5">
          <span aria-hidden>✦</span> AI
        </button>
      </div>
    </header>
  );
}
