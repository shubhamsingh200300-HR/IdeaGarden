import { describe, expect, it } from "vitest";
import { InMemoryTeamMappingStore } from "./teamMappingStore.js";

describe("InMemoryTeamMappingStore", () => {
  it("returns the teams mapped to a given HRBP", () => {
    const store = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-b", teamName: "Mobile Camera", hrbpId: "hrbp-1" },
      { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
    ]);

    const teams = store.getTeamsForHrbp("hrbp-1");

    expect(teams).toEqual([
      { teamId: "team-a", teamName: "Backend Platform" },
      { teamId: "team-b", teamName: "Mobile Camera" },
    ]);
  });

  it("returns an empty list for an HRBP with no mapped teams", () => {
    const store = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);

    expect(store.getTeamsForHrbp("hrbp-unmapped")).toEqual([]);
  });

  it("authorizes an HRBP for a team they're mapped to", () => {
    const store = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);

    expect(store.isAuthorized("hrbp-1", "team-a")).toBe(true);
  });

  it("denies an HRBP for a team they're not mapped to", () => {
    const store = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-b", teamName: "Mobile Camera", hrbpId: "hrbp-2" },
    ]);

    expect(store.isAuthorized("hrbp-1", "team-b")).toBe(false);
  });

  it("denies an HRBP for a team that doesn't exist at all", () => {
    const store = new InMemoryTeamMappingStore([]);

    expect(store.isAuthorized("hrbp-1", "no-such-team")).toBe(false);
  });

  it("gets a single team for an HRBP that's mapped to it", () => {
    const store = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);

    expect(store.getTeam("hrbp-1", "team-a")).toEqual({
      teamId: "team-a",
      teamName: "Backend Platform",
    });
  });

  it("returns undefined getting a team the HRBP isn't mapped to", () => {
    const store = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-2" },
    ]);

    expect(store.getTeam("hrbp-1", "team-a")).toBeUndefined();
  });
});
