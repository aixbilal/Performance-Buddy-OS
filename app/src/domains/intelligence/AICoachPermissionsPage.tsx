import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { useAICoach } from "./store";
import { AI_DOMAINS } from "../ai/context";
import type { PermissionLevel } from "./types";

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "no-access", label: "No access" },
  { value: "read", label: "Read" },
  { value: "read-recommend", label: "Read + Recommend" },
];

/**
 * Context / Permissions (docs 30.05, §36). Per-domain, durable. One domain's
 * permission never implies another's. "No access" is the default for anything
 * not listed. Provider config (no secret) also lives here.
 */
export function AICoachPermissionsPage() {
  const coach = useAICoach();

  return (
    <div className="space-y-6">
      <div>
        <Link to="/ai-coach" className="text-text-muted text-xs hover:text-text-secondary">
          ← AI Coach
        </Link>
        <h2 className="t-h2 text-text-primary mt-1">Context & Permissions</h2>
        <p className="text-text-muted text-sm">
          What the AI Coach may and may not use. Changes are saved immediately and apply to every
          future request.
        </p>
      </div>

      <Card title="Provider">
        <p className="text-text-secondary text-[11px] mb-2">
          The API key is never stored by PBOS. For a real provider, set the{" "}
          <code className="text-text-primary">PBOS_AI_API_KEY</code> environment variable; the
          renderer only ever learns whether one is present.
        </p>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label className="text-text-secondary">
            Provider
            <select
              value={coach.config.providerId}
              onChange={(e) => coach.setConfig({ providerId: e.target.value })}
              aria-label="AI provider"
              className="block mt-1 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs"
            >
              <option value="fake">Deterministic (built-in, no network)</option>
              <option value="openai-compatible">OpenAI-compatible endpoint</option>
            </select>
          </label>
          {coach.config.providerId === "openai-compatible" && (
            <>
              <label className="text-text-secondary">
                Base URL
                <input
                  value={coach.config.baseUrl}
                  onChange={(e) => coach.setConfig({ baseUrl: e.target.value })}
                  aria-label="AI base URL"
                  placeholder="https://api.example.com/v1"
                  className="block mt-1 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs w-56"
                />
              </label>
              <label className="text-text-secondary">
                Model
                <input
                  value={coach.config.model}
                  onChange={(e) => coach.setConfig({ model: e.target.value })}
                  aria-label="AI model"
                  placeholder="gpt-4o-mini"
                  className="block mt-1 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs w-40"
                />
              </label>
              <span className="text-text-muted text-[11px]">
                Credential detected: {coach.credentialsPresent ? "yes" : "no"}
              </span>
            </>
          )}
        </div>
      </Card>

      <Card title="Per-domain access">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs text-left">
              <th className="py-1 font-medium">Domain</th>
              <th className="py-1 font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {AI_DOMAINS.map((d) => {
              const level = coach.permissions[d] ?? "no-access";
              return (
                <tr key={d} className="border-t border-border-subtle">
                  <td className="py-1.5 text-text-primary">{d}</td>
                  <td className="py-1.5">
                    <label htmlFor={`perm-${d}`} className="sr-only">
                      AI access level for {d}
                    </label>
                    <select
                      id={`perm-${d}`}
                      value={level}
                      onChange={(e) => coach.setPermission(d, e.target.value as PermissionLevel)}
                      className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-secondary text-xs"
                    >
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="What the coach can access">
          <ul className="text-text-secondary text-xs list-disc list-inside space-y-1">
            <li>Deterministic summary facts from domains set to Read or Read + Recommend</li>
            <li>The current week's capacity and schedule totals</li>
            <li>Which Knowledge concepts are review-due</li>
            <li>Your typed question in the Workspace (for that request only)</li>
          </ul>
        </Card>
        <Card title="What it never accesses">
          <ul className="text-text-secondary text-xs list-disc list-inside space-y-1">
            <li>Anything from a domain set to No access (Money is No access by default)</li>
            <li>Raw records, exact marks, transaction amounts, or Obsidian note bodies</li>
            <li>A direct write path — every change goes through your decision + validation</li>
            <li>Long-term memory of past conversations</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
