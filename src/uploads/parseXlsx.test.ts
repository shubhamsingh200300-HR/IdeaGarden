import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseXlsxBuffer } from "./parseXlsx.js";
import { buildXlsx } from "./testFixtures.js";

describe("parseXlsxBuffer", () => {
  it("parses headers and rows from a well-formed workbook", async () => {
    const buffer = await buildXlsx(
      ["Department", "Tenure", "Comments"],
      [
        ["Engineering", "3", "Great team, but promotion criteria unclear."],
        ["Design", "1", "Onboarding was smooth."],
      ],
    );

    const table = await parseXlsxBuffer(buffer);

    expect(table.headers).toEqual(["Department", "Tenure", "Comments"]);
    expect(table.rows).toEqual([
      ["Engineering", "3", "Great team, but promotion criteria unclear."],
      ["Design", "1", "Onboarding was smooth."],
    ]);
  });

  it("rejects a buffer that isn't a valid xlsx file", async () => {
    const notXlsx = Buffer.from("this is just plain text, not a spreadsheet");
    await expect(parseXlsxBuffer(notXlsx)).rejects.toThrow(/could not be read/i);
  });

  it("rejects an empty buffer", async () => {
    await expect(parseXlsxBuffer(Buffer.alloc(0))).rejects.toThrow(/could not be read/i);
  });

  it("rejects a workbook with a header row but no data rows", async () => {
    const buffer = await buildXlsx(["Department", "Comments"], []);
    await expect(parseXlsxBuffer(buffer)).rejects.toThrow(/no data rows/i);
  });

  it("rejects a workbook with no worksheets", async () => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseXlsxBuffer(buffer)).rejects.toThrow(/no worksheet/i);
  });
});
