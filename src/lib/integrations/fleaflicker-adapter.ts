import { FantasyPlatformAdapter } from "./types";

export class FleaflickerAdapter implements FantasyPlatformAdapter {
  async getUser(username: string): Promise<any> {
    return { id: "fleaflicker-user-placeholder", username };
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
    return { success: true, syncedAt: new Date(), message: "Fleaflicker sync stubbed." };
  }
}
