import type { ProcessedUpload } from "../uploads/derivedDataStore.js";
import type { LlmClient, Sentiment } from "./llmClient.js";
import { summarizeStructuredColumn, type StructuredDimension } from "./structuredBreakdown.js";

export interface FreeTextTheme {
  column: string;
  label: string;
  count: number;
  sentiment: Sentiment;
}

export interface SignalAnalysisSummary {
  teamId: string;
  analyzedAt: string;
  structuredDimensions: StructuredDimension[];
  freeTextThemes: FreeTextTheme[];
}

/**
 * Diagnoses a team's signals from its already-anonymized, already-ingested
 * upload (ticket 03's DerivedDataStore) - never touches raw data. Only
 * "clean" rows are used; quarantined rows aren't auto-forwarded into
 * either the structured breakdown or the free-text sent to the LLM,
 * consistent with ticket 03's quarantine rule.
 */
export async function analyzeSignals(
  processed: ProcessedUpload,
  llmClient: LlmClient,
): Promise<SignalAnalysisSummary> {
  const cleanRows = processed.rows.filter((row) => row.status === "clean");

  const structuredDimensions: StructuredDimension[] = [];
  const freeTextThemes: FreeTextTheme[] = [];

  for (const [column, classification] of Object.entries(processed.columnClassifications)) {
    const values = cleanRows.map((row) => row.values[column]).filter((v): v is string => v !== undefined);

    if (classification === "structured") {
      structuredDimensions.push(summarizeStructuredColumn(column, values));
    } else if (classification === "free-text") {
      const texts = values.filter((v) => v.trim().length > 0);
      if (texts.length === 0) continue;

      const themes = await llmClient.extractThemes(texts);
      for (const theme of themes) {
        freeTextThemes.push({ column, ...theme });
      }
    }
  }

  return {
    teamId: processed.teamId,
    analyzedAt: new Date().toISOString(),
    structuredDimensions,
    freeTextThemes,
  };
}
