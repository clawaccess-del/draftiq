export interface FantasyPlatformAdapter {
  getUser(username: string): Promise<any>;
  getLeagues(userId: string): Promise<any[]>;
  getLeagueSettings(leagueId: string): Promise<any>;
  getTeams(leagueId: string): Promise<any[]>;
  getRosters(leagueId: string): Promise<any[]>;
  getDrafts(leagueId: string): Promise<any[]>;
  getDraftPicks(draftId: string): Promise<any[]>;
  syncDraft(draftId: string): Promise<any>;
  getUserDrafts?(userId: string, season: string): Promise<any[]>;
  getDraftDetails?(draftId: string): Promise<any>;
}
