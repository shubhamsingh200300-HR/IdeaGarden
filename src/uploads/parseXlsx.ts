import ExcelJS from "exceljs";

export interface RawTable {
  headers: string[];
  rows: string[][];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text);
  return String(value);
}

/**
 * Parses an uploaded .xlsx buffer with no assumed schema - whatever
 * columns exist are returned as-is, per the "no fixed schema" commitment.
 * Rejects outright (clear error, no partial processing) rather than
 * guessing on a malformed or empty file.
 */
export async function parseXlsxBuffer(buffer: Buffer): Promise<RawTable> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's bundled types predate @types/node's stricter Buffer<ArrayBufferLike>
    // generic; this is a type-only mismatch between the two packages, not a runtime one.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error("File could not be read as a valid .xlsx workbook");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Workbook could not be read: no worksheets found");
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(cellText(cell.value));
  });

  if (headers.length === 0) {
    throw new Error("Workbook could not be read: no header row found");
  }

  const rows: string[][] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;
    const values: string[] = [];
    for (let col = 1; col <= headers.length; col++) {
      values.push(cellText(row.getCell(col).value));
    }
    rows.push(values);
  }

  if (rows.length === 0) {
    throw new Error("Workbook could not be read: no data rows found");
  }

  return { headers, rows };
}
