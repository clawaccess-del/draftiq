import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { SleeperAdapter } from "@/lib/integrations/sleeper-adapter";
import { generateRecommendations } from "@/lib/recommendations/recommendation-engine";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { draftId, sleeperDraftId } = await req.json();
    if (!sleeperDraftId) {
      return NextResponse.json({ error: "Sleeper Draft ID is required" }, { status: 400 });
    }

    const adapter = new SleeperAdapter();
    const sleeperPicks = await adapter.getDraftPicks(sleeperDraftId);
    
    // Fetch draft status from Sleeper
    let draftStatus = "active";
    try {
      const draftDetails = await adapter.getDraftDetails(sleeperDraftId);
      if (draftDetails.status === "complete") {
        draftStatus = "completed";
      } else if (draftDetails.status === "paused") {
        draftStatus = "paused";
      }
    } catch (e) {
      console.warn("Failed to fetch draft details status from Sleeper, defaulting to active", e);
    }

    try {
      // 1. Online Database Logic
      const draft = await prisma.draft.findUnique({
        where: { id: draftId },
        include: {
          picks: true,
          league: {
            include: {
              teams: true,
              rankings: {
                include: {
                  player: true,
                },
              },
            },
          },
        },
      });

      if (!draft) {
        return NextResponse.json({ error: "Draft not found in database" }, { status: 404 });
      }

      const existingPicksCount = draft.picks.length;

      // If Sleeper has new picks, sync them to the database
      if (sleeperPicks.length > existingPicksCount) {
        const league = draft.league;
        const teams = league.teams;
        
        // Build a mapping from Sleeper team identifier to our DB team ID
        const teamMappings: Record<string, string> = {};
        teams.forEach((t: any) => {
          if (t.externalTeamId) {
            teamMappings[t.externalTeamId] = t.id;
          }
          // Also map roster slot index
          teamMappings[`roster-${t.draftPosition}`] = t.id;
          teamMappings[`mock-team-${t.draftPosition}`] = t.id;
        });

        // Filter for new picks
        const newPicks = sleeperPicks.slice(existingPicksCount);

        for (const p of newPicks) {
          // 1. Ensure Player exists in DB
          let player = await prisma.player.findFirst({
            where: { id: p.playerId },
          });

          if (!player) {
            const pMetadata = p.metadata || {};
            player = await prisma.player.create({
              data: {
                id: p.playerId,
                name: `${pMetadata.first_name || ""} ${pMetadata.last_name || "Unknown Player"}`.trim() || "Sleeper Player",
                position: pMetadata.position || "RB",
                nflTeam: pMetadata.team || "FA",
                byeWeek: 0,
              },
            });
          }

          // Resolve team DB ID
          // Look up by owner_id (p.teamId), fallback to roster key or slot index
          let teamDbId: string | undefined = teamMappings[p.teamId] || teamMappings[`roster-${p.teamId}`] || teamMappings[p.teamId];
          
          if (!teamDbId) {
            // Fallback: match by draft position slot
            const slot = p.pickNumber % teams.length || teams.length;
            const matchedTeam = teams.find((t: any) => t.draftPosition === slot);
            teamDbId = matchedTeam?.id;
          }

          if (teamDbId) {
            // 3. Create DraftPick
            await prisma.draftPick.create({
              data: {
                draftId: draft.id,
                pickNumber: p.pickNumber,
                roundNumber: p.roundNumber,
                teamId: teamDbId,
                playerId: player.id,
                source: "sleeper",
              },
            });

            // 4. Create Roster record
            await prisma.roster.create({
              data: {
                leagueId: league.id,
                teamId: teamDbId,
                playerId: player.id,
                rosterPosition: player.position,
              },
            });
          }
        }

        // Update Draft State
        const updatedCurrentPick = sleeperPicks.length + 1;
        await prisma.draft.update({
          where: { id: draft.id },
          data: {
            currentPickNumber: updatedCurrentPick,
            status: draftStatus,
          },
        });
      }

      // Reload fresh data from database to return to client
      const freshDraft = await prisma.draft.findUnique({
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

      if (!freshDraft) throw new Error("Reload failed");

      const league = freshDraft.league;
      const teams = league.teams;
      const picks = freshDraft.picks;
      const rankings = league.rankings;

      // Map rankings to available players format
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

      const draftedPlayerIds = new Set(picks.map((p) => p.playerId));
      const availablePlayers = allPlayers.filter((p) => !draftedPlayerIds.has(p.id));

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

      const rosterSettings = league.rosterSettingsJson as any;

      // Generate recommendations
      const recommendations = generateRecommendations(
        rosterSettings,
        {
          currentPick: freshDraft.currentPickNumber,
          totalRounds: freshDraft.totalRounds,
          draftType: freshDraft.draftType as any,
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
        offline: false,
        draft: freshDraft,
        league,
        teams,
        picks,
        availablePlayers,
        teamRosters,
        recommendations: recommendations.slice(0, 8),
      });

    } catch (dbError) {
      // 2. Offline Database Fallback: Return raw Sleeper picks and status for client integration
      console.warn("Database connection failed during sync. Servicing offline proxy sync.", dbError);
      return NextResponse.json({
        success: true,
        offline: true,
        picks: sleeperPicks,
        draftStatus,
        message: "Offline sync. Sync data from Sleeper API loaded. Local client will update.",
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to sync Sleeper draft board" }, { status: 500 });
  }
}
