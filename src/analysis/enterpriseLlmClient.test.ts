import { afterEach, describe, expect, it, vi } from "vitest";
import type { LlmConfig } from "../config.js";

const testConfig: LlmConfig = {
  endpoint: "https://llm.samsung.internal/v1/analyze-themes",
  apiKey: "test-api-key",
  model: "claude-enterprise-default",
};

describe("EnterpriseLlmClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts the texts and model to the configured endpoint with an auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ themes: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { EnterpriseLlmClient } = await import("./enterpriseLlmClient.js");
    const client = new EnterpriseLlmClient(testConfig);

    await client.extractThemes(["Great team, but promotion criteria unclear.", "Onboarding was smooth."]);

    expect(fetchMock).toHaveBeenCalledWith(
      testConfig.endpoint,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: `Bearer ${testConfig.apiKey}`,
        }),
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body.model).toBe(testConfig.model);
    expect(body.texts).toEqual([
      "Great team, but promotion criteria unclear.",
      "Onboarding was smooth.",
    ]);
  });

  it("returns the themes parsed from the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          themes: [
            { label: "career progression clarity", count: 3, sentiment: "negative" },
            { label: "onboarding", count: 1, sentiment: "positive" },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { EnterpriseLlmClient } = await import("./enterpriseLlmClient.js");
    const client = new EnterpriseLlmClient(testConfig);

    const themes = await client.extractThemes(["some text"]);

    expect(themes).toEqual([
      { label: "career progression clarity", count: 3, sentiment: "negative" },
      { label: "onboarding", count: 1, sentiment: "positive" },
    ]);
  });

  it("returns an empty theme list without calling the API when given no texts", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { EnterpriseLlmClient } = await import("./enterpriseLlmClient.js");
    const client = new EnterpriseLlmClient(testConfig);

    const themes = await client.extractThemes([]);

    expect(themes).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when the endpoint responds with an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("internal error"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { EnterpriseLlmClient } = await import("./enterpriseLlmClient.js");
    const client = new EnterpriseLlmClient(testConfig);

    await expect(client.extractThemes(["some text"])).rejects.toThrow(/theme extraction failed/i);
  });
});
