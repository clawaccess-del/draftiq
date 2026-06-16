import { FantasyPlatformAdapter } from "./types";

export class SleeperAdapter implements FantasyPlatformAdapter {
  private baseUrl = process.env.SLEEPER_API_BASE_URL || "https://api.sleeper.app/v1";

  async getUser(username: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/user/${username}`);
    if (!res.ok) throw new Error(`User ${username} not found on Sleeper`);
    return await res.json();
  }

  async getLeagues(userId: string): Promise<any[]> {
    // We check leagues for the current year (2025/2026).
    const year = new Date().getFullYear();
    const res = await fetch(`${this.baseUrl}/user/${userId}/leagues/nfl/${year}`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getLeagueSettings(leagueId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/league/${leagueId}`);
    if (!res.ok) throw new Error(`League ${leagueId} not found on Sleeper`);
    const leagueData = await res.json();

    // Map roster positions list to our RosterSettings structure
    const positions = leagueData.roster_positions || [];
    const settings = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      FLEX: 0,
      SUPERFLEX: 0,
      K: 0,
      DST: 0,
      BENCH: 0,
    };

    positions.forEach((pos: string) => {
      const p = pos.toUpperCase();
      if (p === "QB") settings.QB++;
      else if (p === "RB") settings.RB++;
      else if (p === "WR") settings.WR++;
      else if (p === "TE") settings.TE++;
      else if (p === "FLEX") settings.FLEX++;
      else if (p === "SUPER_FLEX") settings.SUPERFLEX++;
      else if (p === "K") settings.K++;
      else if (p === "DEF") settings.DST++;
      else if (p === "BN") settings.BENCH++;
    });

    return {
      name: leagueData.name,
      platform: "sleeper",
      scoringType: leagueData.scoring_settings?.rec === 1 ? "ppr" : leagueData.scoring_settings?.rec === 0.5 ? "half_ppr" : "standard",
      teamCount: leagueData.total_rosters || 12,
      draftType: leagueData.settings?.draft_rounds ? "snake" : "snake", // Sleeper defaults to snake
      rosterSettings: settings,
      raw: leagueData,
    };
  }

  async getTeams(leagueId: string): Promise<any[]> {
    const [rostersRes, usersRes] = await Promise.all([
      fetch(`${this.baseUrl}/league/${leagueId}/rosters`),
      fetch(`${this.baseUrl}/league/${leagueId}/users`),
    ]);

    if (!rostersRes.ok || !usersRes.ok) return [];

    const rosters = await rostersRes.json();
    const users = await usersRes.json();

    return rosters.map((roster: any) => {
      const user = users.find((u: any) => u.user_id === roster.owner_id);
      return {
        id: roster.owner_id || `roster-${roster.roster_id}`,
        rosterId: roster.roster_id,
        name: user?.display_name || `Team ${roster.roster_id}`,
        ownerName: user?.real_name || user?.display_name || `Owner ${roster.roster_id}`,
        draftPosition: roster.settings?.draft_position || roster.roster_id,
        isUserTeam: false, // will set this client side or checking current userId
        externalTeamId: roster.owner_id,
      };
    });
  }

  async getRosters(leagueId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/league/${leagueId}/rosters`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getDrafts(leagueId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/league/${leagueId}/drafts`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getDraftPicks(draftId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/draft/${draftId}/picks`);
    if (!res.ok) return [];
    const picks = await res.json();

    // Map to draft pick format
    return picks.map((p: any) => ({
      pickNumber: p.pick_no,
      roundNumber: p.round,
      teamId: p.owner_id,
      playerId: p.player_id,
      metadata: p.metadata,
    }));
  }

  async syncDraft(draftId: string): Promise<any> {
    const picks = await this.getDraftPicks(draftId);
    return {
      success: true,
      syncedAt: new Date(),
      picks,
    };
  }
}
