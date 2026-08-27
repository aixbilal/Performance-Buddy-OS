export function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-text-secondary text-sm mb-1">{label}</div>
        <div className="text-text-disabled text-xs">Not implemented yet — routing placeholder only.</div>
      </div>
    </div>
  );
}
