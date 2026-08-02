import type { LlmConfig } from "../config.js";
import type { LlmClient, Theme } from "./llmClient.js";

/**
 * Calls Claude Enterprise or Gemini Enterprise (technical-architecture-
 * spec.md Section 2) to extract recurring themes/sentiment from
 * already-anonymized free text. The request/response shape here is an
 * assumption, not a confirmed API contract - see config.ts's LlmConfig
 * doc comment. Only ever receives anonymized text; the caller (signal
 * analysis) is responsible for that boundary, not this client.
 */
export class EnterpriseLlmClient implements LlmClient {
  constructor(private readonly config: LlmConfig) {}

  async extractThemes(texts: string[]): Promise<Theme[]> {
    if (texts.length === 0) return [];

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model: this.config.model, texts }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM theme extraction failed (${response.status}): ${detail}`);
    }

    const { themes } = (await response.json()) as { themes: Theme[] };
    return themes;
  }
}
