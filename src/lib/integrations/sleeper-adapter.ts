import { FantasyPlatformAdapter } from "./types";

export class SleeperAdapter implements FantasyPlatformAdapter {
  private baseUrl = process.env.SLEEPER_API_BASE_URL || "https://api.sleeper.app/v1";

  async getUser(username: string): Promise<any> {
    // Phase 2 implementation will call: `${this.baseUrl}/user/${username}`
    return { id: "sleeper-user-placeholder", username };
  }

  async getLeagues(userId: string): Promise<any[]> {
    return [];
  }

  async getLeagueSettings(leagueId: string): Promise<any> {
    return {};
  }

  async getTeams(leagueId: string): Promise<any[]> {
    return [];
  }

  async getRosters(leagueId: string): Promise<any[]> {
    return [];
  }

  async getDrafts(leagueId: string): Promise<any[]> {
    return [];
  }

  async getDraftPicks(draftId: string): Promise<any[]> {
    return [];
  }

  async syncDraft(draftId: string): Promise<any> {
    return { success: true, syncedAt: new Date(), message: "Sleeper sync stubbed." };
  }
}
