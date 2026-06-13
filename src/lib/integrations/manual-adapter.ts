import { FantasyPlatformAdapter } from "./types";
import prisma from "@/lib/prisma";

export class ManualAdapter implements FantasyPlatformAdapter {
  async getUser(username: string): Promise<any> {
    return { id: "manual-user", username };
  }

  async getLeagues(userId: string): Promise<any[]> {
    try {
      return await prisma.league.findMany({
        where: { userId },
      });
    } catch {
      return [];
    }
  }

  async getLeagueSettings(leagueId: string): Promise<any> {
    try {
      const league = await prisma.league.findUnique({ where: { id: leagueId } });
      return league?.rosterSettingsJson || {};
    } catch {
      return {};
    }
  }

  async getTeams(leagueId: string): Promise<any[]> {
    try {
      return await prisma.team.findMany({
        where: { leagueId },
        orderBy: { draftPosition: "asc" },
      });
    } catch {
      return [];
    }
  }

  async getRosters(leagueId: string): Promise<any[]> {
    try {
      return await prisma.roster.findMany({
        where: { leagueId },
      });
    } catch {
      return [];
    }
  }

  async getDrafts(leagueId: string): Promise<any[]> {
    try {
      return await prisma.draft.findMany({
        where: { leagueId },
      });
    } catch {
      return [];
    }
  }

  async getDraftPicks(draftId: string): Promise<any[]> {
    try {
      return await prisma.draftPick.findMany({
        where: { draftId },
        orderBy: { pickNumber: "asc" },
      });
    } catch {
      return [];
    }
  }

  async syncDraft(draftId: string): Promise<any> {
    // Manual drafts are already in sync by manual input
    return { success: true, syncedAt: new Date() };
  }
}
