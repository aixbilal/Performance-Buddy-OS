import { Link } from "react-router-dom";
import { buttonClass } from "../components/Button";

/**
 * Catch-all for unknown hash routes. Renders inside the AppShell (sidebar +
 * topbar stay), states plainly that the page does not exist, and offers one
 * route back to Today. No architecture change — a single splat child route in
 * router.tsx points here.
 */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-text-secondary text-sm font-medium mb-1">Page not found</div>
      <p className="text-text-muted text-xs max-w-sm mb-4">
        That page doesn&rsquo;t exist in Performance Buddy OS. It may have moved, or the
        link was mistyped.
      </p>
      <Link to="/" className={buttonClass("primary", "sm")}>
        Back to Today
      </Link>
    </div>
  );
}
