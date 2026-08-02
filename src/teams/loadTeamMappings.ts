import { readFileSync } from "node:fs";
import type { TeamMapping } from "./teamMappingStore.js";

/**
 * Reads the platform-maintained team-to-HRBP mapping from a JSON file
 * (technical-architecture-spec.md, Section 6.2). A full admin CRUD surface
 * for editing this is out of scope for this foundation ticket — for now,
 * "maintained by the platform" means editing this file, not a UI.
 */
export function loadTeamMappings(filePath: string | undefined): TeamMapping[] {
  if (!filePath) return [];

  const contents = JSON.parse(readFileSync(filePath, "utf-8"));
  if (!Array.isArray(contents)) {
    throw new Error(`Team mappings file at ${filePath} must be a JSON array`);
  }

  return contents as TeamMapping[];
}
