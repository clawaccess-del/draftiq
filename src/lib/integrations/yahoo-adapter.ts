import { FantasyPlatformAdapter } from "./types";

export class YahooAdapter implements FantasyPlatformAdapter {
  async getUser(username: string): Promise<any> {
    return { id: "yahoo-user-placeholder", username };
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
    return { success: true, syncedAt: new Date(), message: "Yahoo sync stubbed." };
  }
}
