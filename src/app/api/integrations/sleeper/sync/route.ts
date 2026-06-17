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

    const adapter = new SleeperAdapter();
    let resolvedSleeperDraftId = sleeperDraftId || draftId;
    let dbDraft: any = null;
    let dbConnected = true;

    try {
      dbDraft = await prisma.draft.findUnique({
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
    } catch (e) {
      console.warn("DB connection failed in sync lookup, falling back to offline", e);
      dbConnected = false;
    }

    // Resolve sleeperDraftId using DB metadata if we are online
    if (dbConnected && dbDraft && dbDraft.league.platform === "sleeper") {
      const extId = dbDraft.league.externalLeagueId || "";
      if (extId.startsWith("mock-")) {
        resolvedSleeperDraftId = extId.replace("mock-", "");
      } else if (extId) {
        // It's a Sleeper league. Fetch its drafts list to find the active draft ID
        try {
          const draftsList = await adapter.getDrafts(extId);
          if (draftsList && draftsList[0]) {
            resolvedSleeperDraftId = draftsList[0].draft_id || draftsList[0].id || resolvedSleeperDraftId;
          }
        } catch (err) {
          console.warn("Failed to fetch drafts list for league from Sleeper", err);
        }
      }
    }

    // Clean up offline mock prefixes if any
    if (resolvedSleeperDraftId && typeof resolvedSleeperDraftId === "string" && resolvedSleeperDraftId.startsWith("sleeper-draft-")) {
      resolvedSleeperDraftId = resolvedSleeperDraftId.replace("sleeper-draft-", "");
    }

    if (!resolvedSleeperDraftId) {
      return NextResponse.json({ error: "Sleeper Draft ID is required and could not be resolved" }, { status: 400 });
    }

    // Now query Sleeper API with the correctly resolved Sleeper Draft ID
    const sleeperPicks = await adapter.getDraftPicks(resolvedSleeperDraftId);
    
    // Fetch draft status from Sleeper
    let draftStatus = "active";
    try {
      const draftDetails = await adapter.getDraftDetails(resolvedSleeperDraftId);
      if (draftDetails.status === "complete") {
        draftStatus = "completed";
      } else if (draftDetails.status === "paused") {
        draftStatus = "paused";
      }
    } catch (e) {
      console.warn("Failed to fetch draft details status from Sleeper, defaulting to active", e);
    }

    // If database is connected and we found the draft record, sync picks to DB
    if (dbConnected && dbDraft) {
      const existingPicksCount = dbDraft.picks.length;

      // If Sleeper has new picks, sync them to the database
      if (sleeperPicks.length > existingPicksCount) {
        const league = dbDraft.league;
        const teams = league.teams;
        
        // Build a mapping from Sleeper team identifier to our DB team ID
        const teamMappings: Record<string, string> = {};
        teams.forEach((t: any) => {
          if (t.externalTeamId) {
            teamMappings[t.externalTeamId] = t.id;
            
            // Reconcile roster-X and mock-team-X based on roster ID extracted from externalTeamId
            const rId = t.externalTeamId.replace("mock-team-", "").replace("roster-", "");
            teamMappings[`roster-${rId}`] = t.id;
            teamMappings[`mock-team-${rId}`] = t.id;
          }
          // Also map draftPosition slot index fallback
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

          // 2. Resolve team DB ID using owner_id or roster fallback
          let teamDbId = teamMappings[p.teamId] || teamMappings[`roster-${p.teamId}`] || teamMappings[p.teamId];
          
          if (!teamDbId && p.rosterId) {
            // Match using rosterId matching externalTeamId suffix
            const matchedTeam = teams.find((t: any) => {
              const rId = parseInt(t.externalTeamId?.replace("mock-team-", "") || t.externalTeamId?.replace("roster-", "") || "");
              return rId === p.rosterId;
            });
            teamDbId = matchedTeam?.id;
          }

          if (!teamDbId && p.rosterId) {
            // Fallback: match using rosterId matching draftPosition
            const matchedTeam = teams.find((t: any) => t.draftPosition === p.rosterId);
            teamDbId = matchedTeam?.id;
          }

          if (!teamDbId) {
            // Ultimate fallback: modulo math
            const slot = p.pickNumber % teams.length || teams.length;
            const matchedTeam = teams.find((t: any) => t.draftPosition === slot);
            teamDbId = matchedTeam?.id;
          }

          if (teamDbId) {
            // 3. Create DraftPick
            await prisma.draftPick.create({
              data: {
                draftId: dbDraft.id,
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
          where: { id: dbDraft.id },
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

    } else {
      // 2. Offline Mode response
      return NextResponse.json({
        success: true,
        offline: true,
        picks: sleeperPicks,
        draftStatus,
        message: "Offline sync data loaded.",
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to sync Sleeper draft board" }, { status: 500 });
  }
}
