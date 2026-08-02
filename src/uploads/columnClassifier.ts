export type ColumnClassification = "structured" | "free-text" | "ambiguous";

const FREE_TEXT_HEADER_KEYWORDS = [
  "comment",
  "comments",
  "note",
  "notes",
  "feedback",
  "reason",
  "description",
  "explain",
];

const STRUCTURED_LENGTH_THRESHOLD = 15;
const FREE_TEXT_LENGTH_THRESHOLD = 40;
const STRUCTURED_UNIQUENESS_THRESHOLD = 0.5;
const FREE_TEXT_UNIQUENESS_THRESHOLD = 0.7;

/**
 * A uniqueness *ratio* is only meaningful with enough rows to sample from -
 * with 2 rows, two different department names look "100% unique" even
 * though the column is obviously categorical. Below this row count, the
 * uniqueness signal is skipped entirely rather than trusted.
 */
const MIN_ROWS_FOR_UNIQUENESS_SIGNAL = 5;

/**
 * Deterministic, on-prem, rule-based column classifier — no fixed schema
 * assumed, no model call. Combines header keywords with data-shape
 * signals; when they disagree (or shape alone is inconclusive), the
 * column is flagged "ambiguous" for the HRBP to confirm rather than
 * guessed, per the ticket's "ask, don't guess" rule.
 */
export function classifyColumn(header: string, values: string[]): ColumnClassification {
  const lowerHeader = header.toLowerCase();
  if (FREE_TEXT_HEADER_KEYWORDS.some((keyword) => lowerHeader.includes(keyword))) {
    return "free-text";
  }

  if (values.length === 0) return "structured";

  const avgLength = values.reduce((sum, v) => sum + v.length, 0) / values.length;

  if (avgLength <= STRUCTURED_LENGTH_THRESHOLD) return "structured";
  if (avgLength > FREE_TEXT_LENGTH_THRESHOLD) return "free-text";

  if (values.length >= MIN_ROWS_FOR_UNIQUENESS_SIGNAL) {
    const uniquenessRatio = new Set(values).size / values.length;
    if (uniquenessRatio <= STRUCTURED_UNIQUENESS_THRESHOLD) return "structured";
    if (uniquenessRatio > FREE_TEXT_UNIQUENESS_THRESHOLD) return "free-text";
  }

  return "ambiguous";
}
