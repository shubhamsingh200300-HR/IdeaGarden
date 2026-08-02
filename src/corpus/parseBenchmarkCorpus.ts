export interface CorpusEntry {
  id: string;
  company: string;
  initiative: string;
  primarySignal: string;
  secondarySignals: string[];
  structure: string;
  impactEvidence: string;
  sources: string[];
}

const FIELD_PATTERN = /^- \*\*(\w+)\*\*:\s*(.*)$/;

/** Splits on a single-character delimiter, but never inside parentheses (e.g. an aside containing its own comma). */
function splitOutsideParens(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth--;

    if (char === delimiter && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Parses the "### id: <slug>" entries out of the benchmark corpus markdown
 * (wayfinder/research/benchmark-corpus.md's format). Ignores everything
 * else in the file, including the "Entries deliberately excluded" section,
 * since it never uses the "### id:" heading.
 */
export function parseBenchmarkCorpus(markdown: string): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  const blocks = markdown.split(/^### id: /m).slice(1);

  for (const block of blocks) {
    const lines = block.split("\n");
    const id = lines[0].trim();

    let company = "";
    let initiative = "";
    let primarySignal = "";
    let secondarySignals: string[] = [];
    let structure = "";
    let impactEvidence = "";
    const sources: string[] = [];

    let i = 1;
    while (i < lines.length) {
      const line = lines[i];
      const match = FIELD_PATTERN.exec(line);

      if (match) {
        const [, field, value] = match;
        if (field === "company") company = value.trim();
        else if (field === "initiative") initiative = value.trim();
        else if (field === "structure") structure = value.trim();
        else if (field === "impact_evidence") impactEvidence = value.trim();
        else if (field === "signals") {
          const signalsMatch = /primary:\s*(.+?);\s*secondary:\s*(.*)/.exec(value);
          if (signalsMatch) {
            primarySignal = signalsMatch[1].trim();
            secondarySignals = splitOutsideParens(signalsMatch[2], ",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        } else if (field === "sources") {
          i++;
          while (i < lines.length && lines[i].trim().startsWith("-")) {
            sources.push(lines[i].trim().replace(/^-\s*/, ""));
            i++;
          }
          continue;
        }
      }
      i++;
    }

    entries.push({
      id,
      company,
      initiative,
      primarySignal,
      secondarySignals,
      structure,
      impactEvidence,
      sources,
    });
  }

  return entries;
}
