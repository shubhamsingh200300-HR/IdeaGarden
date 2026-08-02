export type Sentiment = "positive" | "negative" | "neutral" | "mixed";

export interface Theme {
  label: string;
  count: number;
  sentiment: Sentiment;
}

export interface LlmClient {
  /** Only ever called with already-anonymized text (technical-architecture-spec.md Section 2). */
  extractThemes(texts: string[]): Promise<Theme[]>;
}
