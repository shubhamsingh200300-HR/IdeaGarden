import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToFile } from "../uploads/encryptedFile.js";
import { RequestIntakeStore } from "./requestIntakeStore.js";

describe("RequestIntakeStore", () => {
  let dir: string;
  let store: RequestIntakeStore;
  const key = randomBytes(32);
  const constraints = { budget: "up to 50,000 INR", time: "half a day max", headcountLogistics: "team of 8" };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "request-intake-store-"));
    store = new RequestIntakeStore(dir, key);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  describe("createInvite", () => {
    it("creates a pending request with a token and no content yet", () => {
      const invite = store.createInvite("team-a", "hrbp-1");

      expect(invite.status).toBe("pending");
      expect(invite.teamId).toBe("team-a");
      expect(invite.hrbpId).toBe("hrbp-1");
      expect(invite.context).toBe("");
      expect(invite.token).toMatch(/^[a-f0-9]{64}$/);
      expect(invite.submittedAt).toBeNull();
    });

    it("is retrievable as the team's latest request", () => {
      const invite = store.createInvite("team-a", "hrbp-1");
      expect(store.getLatest("team-a")).toEqual(invite);
    });

    it("creating a new invite for the same team invalidates the previous one's token", () => {
      const first = store.createInvite("team-a", "hrbp-1");
      store.createInvite("team-a", "hrbp-1");

      const result = store.submitByToken(first.token!, "Some context.", constraints);
      expect(result.ok).toBe(false);
    });
  });

  describe("checkToken", () => {
    it("finds a pending request by its current token", () => {
      const invite = store.createInvite("team-a", "hrbp-1");
      const result = store.checkToken(invite.token!);
      expect(result).toEqual({ ok: true, request: invite });
    });

    it("rejects an unknown token", () => {
      expect(store.checkToken("nonexistent-token")).toEqual({ ok: false, reason: "not-found" });
    });

    it("rejects a path-traversal attempt as not-found, never touching the filesystem outside its own directory", () => {
      // Attacker-controlled token from a public URL param - must never be
      // usable as a raw path segment.
      expect(store.checkToken("../../server")).toEqual({ ok: false, reason: "not-found" });
      expect(store.checkToken("../team-a/latest")).toEqual({ ok: false, reason: "not-found" });
    });

    it("rejects a traversal token even when it would otherwise reach and successfully decrypt a real sibling file", () => {
      // Prove this isn't just "the target happens not to exist": plant a
      // decoy exactly where the naive join(baseDir, "tokens", `${token}.enc`)
      // would land for a token of "../evil", encrypted with the same key,
      // shaped to resolve to a real pending invite if traversal succeeded.
      const invite = store.createInvite("team-a", "hrbp-1");
      const decoyPath = join(dir, "evil.enc"); // baseDir/tokens/../evil.enc === baseDir/evil.enc
      encryptToFile(decoyPath, Buffer.from(JSON.stringify({ teamId: "team-a", requestId: invite.id })), key);

      expect(store.checkToken("../evil")).toEqual({ ok: false, reason: "not-found" });
    });

    it("never throws for a malformed token, even one shaped to look like a real token elsewhere in this app", () => {
      expect(() => store.checkToken("not-a-valid-hex-token")).not.toThrow();
      expect(() => store.checkToken("a".repeat(63))).not.toThrow(); // one char short of valid length
      expect(() => store.checkToken("g".repeat(64))).not.toThrow(); // right length, non-hex chars
    });

    it("rejects a token superseded by a newer invite for the same team, as not-found", () => {
      const first = store.createInvite("team-a", "hrbp-1");
      store.createInvite("team-a", "hrbp-1");

      expect(store.checkToken(first.token!)).toEqual({ ok: false, reason: "not-found" });
    });
  });

  describe("submitByToken", () => {
    it("fills in context and constraints, marks submitted, and invalidates the token", () => {
      const invite = store.createInvite("team-a", "hrbp-1");

      const result = store.submitByToken(invite.token!, "The team shipped a rough launch.", constraints);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      expect(result.request.status).toBe("submitted");
      expect(result.request.context).toBe("The team shipped a rough launch.");
      expect(result.request.constraints).toEqual(constraints);
      expect(result.request.token).toBeNull();
      expect(result.request.submittedAt).not.toBeNull();

      expect(store.getLatest("team-a")?.status).toBe("submitted");
      expect(store.checkToken(invite.token!)).toEqual({ ok: false, reason: "already-submitted" });
    });

    it("rejects an unknown token", () => {
      const result = store.submitByToken("nonexistent-token", "context", constraints);
      expect(result).toEqual({ ok: false, reason: "not-found" });
    });

    it("rejects a token that's already been used", () => {
      const invite = store.createInvite("team-a", "hrbp-1");
      store.submitByToken(invite.token!, "First submission.", constraints);

      const result = store.submitByToken(invite.token!, "Second attempt.", constraints);
      expect(result).toEqual({ ok: false, reason: "already-submitted" });
    });

    it("rejects an expired token", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const invite = store.createInvite("team-a", "hrbp-1", 1000 * 60 * 60); // 1 hour expiry

      vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z")); // 2 hours later

      const result = store.submitByToken(invite.token!, "Too late.", constraints);
      expect(result).toEqual({ ok: false, reason: "expired" });
    });

    it("defaults to a 7-day expiry when none is specified", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const invite = store.createInvite("team-a", "hrbp-1");

      vi.setSystemTime(new Date("2026-01-07T23:00:00.000Z")); // just under 7 days later
      expect(store.submitByToken(invite.token!, "Still in time.", constraints).ok).toBe(true);
    });
  });

  describe("getReadyForGeneration", () => {
    it("returns undefined while the request is still pending", () => {
      store.createInvite("team-a", "hrbp-1");
      expect(store.getReadyForGeneration("team-a")).toBeUndefined();
    });

    it("returns the request once it's been submitted", () => {
      const invite = store.createInvite("team-a", "hrbp-1");
      store.submitByToken(invite.token!, "Some context.", constraints);

      expect(store.getReadyForGeneration("team-a")?.status).toBe("submitted");
    });

    it("returns undefined when nothing has been requested for the team at all", () => {
      expect(store.getReadyForGeneration("team-z")).toBeUndefined();
    });
  });

  it("does not store plaintext on disk", () => {
    const invite = store.createInvite("team-a", "hrbp-1");
    store.submitByToken(invite.token!, "Super sensitive team context here.", constraints);

    const files = readdirSync(join(dir, "team-a"));
    const contents = readFileSync(join(dir, "team-a", files[0]));
    expect(contents.includes(Buffer.from("Super sensitive team context here."))).toBe(false);
  });
});
