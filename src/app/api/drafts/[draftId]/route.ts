import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { generateRecommendations } from "@/lib/recommendations/recommendation-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { draftId } = await params;

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if database is connected
    try {
      const draft = await prisma.draft.findUnique({
        where: { id: draftId },
        include: {
          league: {
            include: {
              teams: {
                orderBy: { draftPosition: "asc" },
              },
              rankings: {
                include: {
                  player: true,
                },
              },
            },
          },
          picks: {
            orderBy: { pickNumber: "asc" },
            include: {
              player: true,
            },
          },
        },
      });

      if (!draft) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }

      // Build roster lists
      const league = draft.league;
      const teams = league.teams;
      const picks = draft.picks;
      const rankings = league.rankings;

      // Extract all players mapped to rankings
      const allPlayers = rankings.map((r) => ({
        id: r.player.id,
        name: r.player.name,
        position: r.player.position,
        nflTeam: r.player.nflTeam,
        byeWeek: r.player.byeWeek,
        injuryStatus: r.player.injuryStatus,
        overallRank: r.overallRank,
        positionRank: r.positionRank,
        projectedPoints: r.projectedPoints,
        adp: r.adp,
        tier: r.tier,
        riskScore: r.riskScore,
        ceilingProjection: r.ceilingProjection,
        floorProjection: r.floorProjection,
        notes: r.notes,
      }));

      // Find drafted player IDs
      const draftedPlayerIds = new Set(picks.map((p) => p.playerId));
      const availablePlayers = allPlayers.filter((p) => !draftedPlayerIds.has(p.id));

      // Build rosters for each team
      const teamRosters = teams.map((t) => {
        const teamPicks = picks.filter((p) => p.teamId === t.id);
        const teamPlayers = teamPicks
          .map((p) => allPlayers.find((player) => player.id === p.playerId))
          .filter(Boolean) as any[];

        return {
          teamId: t.id,
          name: t.name,
          isUserTeam: t.isUserTeam,
          draftPosition: t.draftPosition,
          players: teamPlayers,
        };
      });

      // Parse roster settings
      const rosterSettings = league.rosterSettingsJson as any;

      // Generate recommendations
      const recommendations = generateRecommendations(
        rosterSettings,
        {
          currentPick: draft.currentPickNumber,
          totalRounds: draft.totalRounds,
          draftType: draft.draftType as any,
          teamCount: league.teamCount,
          userPosition: teams.find((t) => t.isUserTeam)?.draftPosition || 1,
          picks: picks.map((p) => ({
            pickNumber: p.pickNumber,
            roundNumber: p.roundNumber,
            teamId: p.teamId,
            playerId: p.playerId,
          })),
        },
        teamRosters,
        availablePlayers
      );

      return NextResponse.json({
        success: true,
        draft,
        league,
        teams,
        picks,
        availablePlayers,
        teamRosters,
        recommendations: recommendations.slice(0, 8), // return top 8 recommendations
      });
    } catch (dbError) {
      console.warn("Database connection failed. Serving offline layout code.", dbError);
      return NextResponse.json({
        success: true,
        offline: true,
        message: "Offline mode active. Data fetched from localStorage client-side.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
