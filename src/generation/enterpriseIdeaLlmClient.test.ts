import { afterEach, describe, expect, it, vi } from "vitest";
import type { LlmConfig } from "../config.js";
import type { IdeaGenerationInput } from "./ideaLlmClient.js";

const testConfig: LlmConfig = {
  endpoint: "https://llm.samsung.internal/v1/generate-idea",
  apiKey: "test-api-key",
  model: "claude-enterprise-default",
};

const testInput: IdeaGenerationInput = {
  signal: "career progression clarity",
  context: "Engineers say promotion criteria feel arbitrary.",
  constraints: { budget: "up to 50,000 INR", time: "half a day max", headcountLogistics: "team of 8" },
  corpusExamples: [
    {
      company: "Google",
      initiative: "Promotion packet & calibration committee process",
      structure: "Structured written packets reviewed by a calibration committee.",
    },
  ],
};

describe("EnterpriseIdeaLlmClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts the signal, context, constraints, and corpus examples to the configured endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          title: "Quarterly Promotion Calibration Council",
          description: "A standing panel reviews promotion packets against transparent criteria.",
          signalAddressed: "career progression clarity",
          structuralFormat: "Quarterly, standing panel",
          isRecurringOrStructural: true,
          ownerRole: "Engineering Director",
          sponsorshipLevel: "org",
          estimatedCostInr: 0,
          estimatedEffort: "4 hours per quarter",
          successMetric: "Improved survey score",
          feasibilityScore: 0.8,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { EnterpriseIdeaLlmClient } = await import("./enterpriseIdeaLlmClient.js");
    const client = new EnterpriseIdeaLlmClient(testConfig);

    await client.generateIdea(testInput);

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
    expect(body.signal).toBe(testInput.signal);
    expect(body.context).toBe(testInput.context);
    expect(body.constraints).toEqual(testInput.constraints);
    expect(body.corpusExamples).toEqual(testInput.corpusExamples);
  });

  it("returns the generated idea draft parsed from the response", async () => {
    const draft = {
      title: "Quarterly Promotion Calibration Council",
      description: "A standing panel reviews promotion packets.",
      signalAddressed: "career progression clarity",
      structuralFormat: "Quarterly, standing panel",
      isRecurringOrStructural: true,
      ownerRole: "Engineering Director",
      sponsorshipLevel: "org",
      estimatedCostInr: 0,
      estimatedEffort: "4 hours per quarter",
      successMetric: "Improved survey score",
      feasibilityScore: 0.8,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(draft) }));

    const { EnterpriseIdeaLlmClient } = await import("./enterpriseIdeaLlmClient.js");
    const client = new EnterpriseIdeaLlmClient(testConfig);

    expect(await client.generateIdea(testInput)).toEqual(draft);
  });

  it("throws a clear error when the endpoint responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("internal error") }),
    );

    const { EnterpriseIdeaLlmClient } = await import("./enterpriseIdeaLlmClient.js");
    const client = new EnterpriseIdeaLlmClient(testConfig);

    await expect(client.generateIdea(testInput)).rejects.toThrow(/idea generation failed/i);
  });
});
