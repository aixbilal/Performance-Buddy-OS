import type { AIFailureClass, AIProvider, AIProviderConfig, AIRequest, AIResponse } from "./types";
import { FakeProvider } from "./fakeProvider";
import { RemoteOpenAIProvider } from "./remoteProvider";

export * from "./types";
export * from "./context";
export { FakeProvider } from "./fakeProvider";
export { RemoteOpenAIProvider } from "./remoteProvider";

/** Reports a fixed failure and never makes a call — used for disabled / not-configured. */
export class NullProvider implements AIProvider {
  readonly id = "null";
  readonly kind = "null" as const;
  private failure: AIFailureClass;
  constructor(failure: AIFailureClass) {
    this.failure = failure;
  }
  status() {
    return { ready: false, failure: this.failure };
  }
  async complete(_req: AIRequest): Promise<AIResponse> {
    void _req;
    const message =
      this.failure === "disabled"
        ? "AI is switched off. PBOS works fully without it."
        : "No AI provider is configured yet.";
    return { ok: false, failure: this.failure, message };
  }
}

/**
 * Pick the provider from config. Switching providers never changes domain
 * authority or the approval flow (docs 24.12) — only who answers `complete`.
 */
export function makeAIProvider(
  cfg: AIProviderConfig,
  credentialsPresent: boolean,
): AIProvider {
  if (!cfg.enabled) return new NullProvider("disabled");
  if (!cfg.providerId || cfg.providerId === "fake") return new FakeProvider();
  if (cfg.providerId === "openai-compatible") {
    if (!credentialsPresent || !cfg.baseUrl) return new NullProvider("not-configured");
    return new RemoteOpenAIProvider({ baseUrl: cfg.baseUrl, model: cfg.model });
  }
  return new NullProvider("not-configured");
}
