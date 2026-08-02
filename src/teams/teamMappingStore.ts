export interface Team {
  teamId: string;
  teamName: string;
}

export interface TeamMapping extends Team {
  hrbpId: string;
}

export interface TeamMappingStore {
  getTeamsForHrbp(hrbpId: string): Team[];
  isAuthorized(hrbpId: string, teamId: string): boolean;
  getTeam(hrbpId: string, teamId: string): Team | undefined;
}

/**
 * Platform-maintained mapping, per the technical architecture spec's
 * decision to not query an external Samsung HR system of record.
 */
export class InMemoryTeamMappingStore implements TeamMappingStore {
  constructor(private readonly mappings: TeamMapping[]) {}

  getTeamsForHrbp(hrbpId: string): Team[] {
    return this.mappings
      .filter((mapping) => mapping.hrbpId === hrbpId)
      .map(({ teamId, teamName }) => ({ teamId, teamName }));
  }

  isAuthorized(hrbpId: string, teamId: string): boolean {
    return this.getTeam(hrbpId, teamId) !== undefined;
  }

  getTeam(hrbpId: string, teamId: string): Team | undefined {
    const mapping = this.mappings.find(
      (m) => m.hrbpId === hrbpId && m.teamId === teamId,
    );
    return mapping ? { teamId: mapping.teamId, teamName: mapping.teamName } : undefined;
  }
}
