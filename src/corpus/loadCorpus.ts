import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseBenchmarkCorpus, type CorpusEntry } from "./parseBenchmarkCorpus.js";

const DEFAULT_CORPUS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../wayfinder/research/benchmark-corpus.md",
);

export function loadCorpus(filePath: string = DEFAULT_CORPUS_PATH): CorpusEntry[] {
  const markdown = readFileSync(filePath, "utf-8");
  return parseBenchmarkCorpus(markdown);
}
