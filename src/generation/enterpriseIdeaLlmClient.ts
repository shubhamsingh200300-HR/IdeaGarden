import type { LlmConfig } from "../config.js";
import type { GeneratedIdeaDraft, IdeaGenerationInput, IdeaLlmClient } from "./ideaLlmClient.js";

/**
 * Calls Claude Enterprise or Gemini Enterprise to generate a tailored idea
 * grounded in retrieved corpus examples (content-spec ticket 006: hybrid
 * RAG). Same endpoint-shape caveat as enterpriseLlmClient.ts - this is an
 * assumption pending confirmation against whichever provider is approved.
 * Only ever receives anonymized context/constraints; the caller (idea
 * generation orchestration) owns that boundary, not this client.
 */
export class EnterpriseIdeaLlmClient implements IdeaLlmClient {
  constructor(private readonly config: LlmConfig) {}

  async generateIdea(input: IdeaGenerationInput): Promise<GeneratedIdeaDraft> {
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model: this.config.model, ...input }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM idea generation failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as GeneratedIdeaDraft;
  }
}
