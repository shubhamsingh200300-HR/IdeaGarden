import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { decryptFromFile, encryptToFile } from "../uploads/encryptedFile.js";

export interface RequestConstraints {
  budget: string;
  time: string;
  headcountLogistics: string;
}

export type RequestStatus = "pending" | "submitted";

export interface GenerationRequest {
  id: string;
  teamId: string;
  hrbpId: string;
  status: RequestStatus;
  context: string;
  constraints: RequestConstraints;
  /** Present only while pending; null once submitted. */
  token: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  submittedAt: string | null;
}

export type TokenCheckResult =
  | { ok: true; request: GenerationRequest }
  | { ok: false; reason: "not-found" | "expired" | "already-submitted" };

interface TokenIndexEntry {
  teamId: string;
  requestId: string;
}

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// createInvite only ever produces tokens matching this exact shape. A token
// arriving here from the public manager routes is fully attacker-controlled
// (it's a URL param) and gets used to build a filesystem path - anything
// not matching this shape is rejected before it ever reaches a path join,
// closing off path traversal (e.g. "../team-a/latest") at the root rather
// than relying on the request-id match to coincidentally fail.
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/**
 * On-prem, per-team-scoped storage for the manager-input request
 * lifecycle (ticket 10, superseding ticket 04's HRBP-relay mechanism):
 * an HRBP creates an invite (pending, tokened), a manager submits
 * through the token (no login), and the request becomes usable by
 * generation only once submitted.
 *
 * The token index (token -> {teamId, requestId}) is kept even after
 * submission - not deleted - specifically so a replay of a used token
 * can be told apart from a token that never existed or was superseded
 * by a newer invite for the same team, without needing to track full
 * history elsewhere.
 *
 * Token lookup is by exact filesystem path (the token IS the lookup
 * key), not a `===` comparison against a stored value read into memory
 * first - this sidesteps the classic timing-attack shape where
 * character-by-character comparison leaks how much of a guess matched.
 * With a 256-bit random token, brute-force guessing is infeasible
 * regardless; the real control here is that the token itself is never
 * transmitted anywhere it doesn't need to be.
 */
export class RequestIntakeStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  createInvite(teamId: string, hrbpId: string, expiresInMs: number = DEFAULT_EXPIRY_MS): GenerationRequest {
    const now = new Date();
    const token = randomBytes(32).toString("hex");

    const request: GenerationRequest = {
      id: randomUUID(),
      teamId,
      hrbpId,
      status: "pending",
      context: "",
      constraints: { budget: "", time: "", headcountLogistics: "" },
      token,
      tokenExpiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
      createdAt: now.toISOString(),
      submittedAt: null,
    };

    this.saveForTeam(request);
    this.saveTokenIndex(token, { teamId, requestId: request.id });

    return request;
  }

  getLatest(teamId: string): GenerationRequest | undefined {
    const filePath = this.teamFilePath(teamId);
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(decryptFromFile(filePath, this.key).toString()) as GenerationRequest;
  }

  getReadyForGeneration(teamId: string): GenerationRequest | undefined {
    const latest = this.getLatest(teamId);
    return latest?.status === "submitted" ? latest : undefined;
  }

  /**
   * Read-only classification of a token: whether it's currently usable to
   * submit against, and if not, why (not-found covers both "never
   * existed" and "superseded by a newer invite for the same team" - both
   * mean this specific request is no longer the team's current one).
   * Used by both the GET form-display route and submitByToken, so the
   * two never disagree about a token's state.
   */
  checkToken(token: string): TokenCheckResult {
    if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "not-found" };

    const index = this.readTokenIndex(token);
    if (!index) return { ok: false, reason: "not-found" };

    const latest = this.getLatest(index.teamId);
    if (!latest || latest.id !== index.requestId) {
      return { ok: false, reason: "not-found" };
    }
    if (latest.status === "submitted") return { ok: false, reason: "already-submitted" };
    if (new Date(latest.tokenExpiresAt!).getTime() < Date.now()) return { ok: false, reason: "expired" };

    return { ok: true, request: latest };
  }

  submitByToken(token: string, context: string, constraints: RequestConstraints): TokenCheckResult {
    const check = this.checkToken(token);
    if (!check.ok) return check;

    const submitted: GenerationRequest = {
      ...check.request,
      status: "submitted",
      context,
      constraints,
      token: null,
      tokenExpiresAt: null,
      submittedAt: new Date().toISOString(),
    };
    this.saveForTeam(submitted);

    return { ok: true, request: submitted };
  }

  private saveForTeam(request: GenerationRequest): void {
    const dir = join(this.baseDir, request.teamId);
    mkdirSync(dir, { recursive: true });
    encryptToFile(this.teamFilePath(request.teamId), Buffer.from(JSON.stringify(request)), this.key);
  }

  private teamFilePath(teamId: string): string {
    return join(this.baseDir, teamId, "latest.enc");
  }

  private saveTokenIndex(token: string, entry: TokenIndexEntry): void {
    const dir = join(this.baseDir, "tokens");
    mkdirSync(dir, { recursive: true });
    encryptToFile(this.tokenFilePath(token), Buffer.from(JSON.stringify(entry)), this.key);
  }

  private readTokenIndex(token: string): TokenIndexEntry | undefined {
    const filePath = this.tokenFilePath(token);
    if (!existsSync(filePath)) return undefined;
    // Defense in depth alongside the TOKEN_PATTERN check above: any failure
    // to decrypt/parse (corrupt file, unexpected shape) fails safe rather
    // than throwing an uncaught exception from a publicly-reachable path.
    try {
      return JSON.parse(decryptFromFile(filePath, this.key).toString()) as TokenIndexEntry;
    } catch {
      return undefined;
    }
  }

  private tokenFilePath(token: string): string {
    return join(this.baseDir, "tokens", `${token}.enc`);
  }
}
