export interface BreakdownEntry {
  value: string;
  count: number;
}

export interface StructuredDimension {
  column: string;
  breakdown: BreakdownEntry[];
}

const MIN_GROUP_SIZE = 5;
export const ROLLUP_LABEL = "Other (combined for privacy)";

/**
 * Groups a structured column's values and applies the group-size-5 rule
 * (technical-architecture-spec.md / content-spec ticket 009): any group
 * smaller than 5 is never shown as-is or silently dropped - all such
 * groups are merged into a single combined bucket. No natural "next
 * broader group" can be inferred for an arbitrary, unknown column (no
 * fixed schema), so unlike the tenure-bucket example in the spec, this
 * always rolls up to one generic combined bucket rather than a
 * semantically-adjacent one.
 */
export function summarizeStructuredColumn(column: string, values: string[]): StructuredDimension {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const breakdown: BreakdownEntry[] = [];
  let rolledUpCount = 0;

  for (const [value, count] of counts) {
    if (count >= MIN_GROUP_SIZE) {
      breakdown.push({ value, count });
    } else {
      rolledUpCount += count;
    }
  }

  if (rolledUpCount > 0) {
    breakdown.push({ value: ROLLUP_LABEL, count: rolledUpCount });
  }

  return { column, breakdown };
}
