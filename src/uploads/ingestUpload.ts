import { classifyColumn } from "./columnClassifier.js";
import type { AuditEvent, FileAuditLog } from "./auditLog.js";
import type { DerivedDataStore, ProcessedRow, ProcessedUpload } from "./derivedDataStore.js";
import { parseXlsxBuffer } from "./parseXlsx.js";
import { redactPatterns, scrubText } from "./piiScrubber.js";
import type { EncryptedFileSystemStore, SourceType } from "./rawFileStore.js";

// A column can be classified "structured" by shape (short values) while its
// header still signals it holds identity data - e.g. "Manager Name" is
// usually a handful of short words, well under the free-text length
// threshold. Header keywords catch what shape-based classification can't:
// full name/quarantine scrubbing applies here regardless of classification.
const IDENTITY_HEADER_KEYWORDS = ["name", "manager", "employee", "hrbp"];

function isIdentityHeader(header: string): boolean {
  const lower = header.toLowerCase();
  return IDENTITY_HEADER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export interface IngestDeps {
  rawFileStore: EncryptedFileSystemStore;
  derivedDataStore: DerivedDataStore;
  auditLog: FileAuditLog;
}

export type IngestResult =
  | { status: "rejected"; reason: string }
  | { status: "needs-confirmation"; ambiguousColumns: string[] }
  | { status: "processed"; fileId: string; cleanRowCount: number; quarantinedRowCount: number };

/**
 * Orchestrates the full upload pipeline (technical-architecture-spec.md
 * Section 3): parse -> classify columns -> scrub free text -> store raw
 * (encrypted, per-team, with retention against the previous cycle) ->
 * store derived data (encrypted, retained indefinitely). Ask, don't
 * guess: an ambiguous column or a malformed file halts processing before
 * anything is stored.
 */
export async function ingestUpload(
  deps: IngestDeps,
  teamId: string,
  sourceType: SourceType,
  buffer: Buffer,
): Promise<IngestResult> {
  let table;
  try {
    table = await parseXlsxBuffer(buffer);
  } catch (error) {
    return { status: "rejected", reason: (error as Error).message };
  }

  const columnsByIndex = table.headers.map((header, i) => ({
    header,
    values: table.rows.map((row) => row[i]),
  }));

  const classifications = new Map(
    columnsByIndex.map(({ header, values }) => [header, classifyColumn(header, values)]),
  );

  const ambiguousColumns = [...classifications.entries()]
    .filter(([, classification]) => classification === "ambiguous")
    .map(([header]) => header);

  if (ambiguousColumns.length > 0) {
    return { status: "needs-confirmation", ambiguousColumns };
  }

  const rows: ProcessedRow[] = table.rows.map((row) => {
    const values: Record<string, string> = {};
    const quarantineReasons: string[] = [];

    table.headers.forEach((header, i) => {
      const rawValue = row[i];
      if (classifications.get(header) === "free-text" || isIdentityHeader(header)) {
        const scrubbed = scrubText(rawValue);
        values[header] = scrubbed.redactedText;
        quarantineReasons.push(...scrubbed.flaggedTerms);
      } else {
        // Not free-text and no identity-header signal, but PII patterns
        // (email/phone/employee-ID) can still appear in any column - regex
        // redaction is cheap and safe to apply everywhere.
        values[header] = redactPatterns(rawValue);
      }
    });

    return quarantineReasons.length > 0
      ? { status: "quarantined", values, quarantineReasons }
      : { status: "clean", values };
  });

  const previousFileId = deps.rawFileStore.getCurrentFileId(teamId, sourceType);
  const { fileId } = deps.rawFileStore.save(teamId, sourceType, buffer);

  if (previousFileId) {
    deps.rawFileStore.delete(teamId, sourceType, previousFileId);
    const event: AuditEvent = {
      type: "raw-data-deleted",
      teamId,
      sourceType,
      deletedFileId: previousFileId,
      timestamp: new Date().toISOString(),
    };
    deps.auditLog.append(event);
  }

  const processed: ProcessedUpload = {
    teamId,
    sourceType,
    uploadedAt: new Date().toISOString(),
    columnClassifications: Object.fromEntries(classifications),
    rows,
  };
  deps.derivedDataStore.save(processed);

  return {
    status: "processed",
    fileId,
    cleanRowCount: rows.filter((r) => r.status === "clean").length,
    quarantinedRowCount: rows.filter((r) => r.status === "quarantined").length,
  };
}
