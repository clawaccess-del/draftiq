import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { SleeperAdapter } from "@/lib/integrations/sleeper-adapter";
import { generateRecommendations } from "@/lib/recommendations/recommendation-engine";

function cleanPlayerName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

        if (newPicks.length > 0) {
          const newPlayerIds = newPicks.map((p) => p.playerId);
          const newPlayerNames = newPicks.map((p) => `${p.metadata?.first_name || ""} ${p.metadata?.last_name || ""}`.trim());

          // 1. Fetch existing players by Sleeper ID
          const existingPlayersById = await prisma.player.findMany({
            where: { id: { in: newPlayerIds } },
          });

          // 2. Fetch existing players by Name to match CSV imported ones
          const existingPlayersByName = await prisma.player.findMany({
            where: {
              name: { in: newPlayerNames },
            },
          });

          // Map Sleeper Player ID to the authoritative DB Player ID
          const playerMap = new Map<string, string>();
          const playerRecordsMap = new Map<string, any>();

          // Extract rankings players from dbDraft
          const rankingsPlayers = dbDraft.league.rankings.map((r: any) => r.player);

          for (const p of newPicks) {
            const name = `${p.metadata?.first_name || ""} ${p.metadata?.last_name || ""}`.trim();
            const position = p.metadata?.position?.toUpperCase() || "RB";

            // 1. Try matching by Sleeper ID first
            const matchedById = existingPlayersById.find((pl) => pl.id === p.playerId);
            if (matchedById) {
              playerMap.set(p.playerId, matchedById.id);
              playerRecordsMap.set(matchedById.id, matchedById);
              continue;
            }

            // 2. Try matching by name and position in rankings using cleanPlayerName (highly accurate for CSV rankings matching)
            const matchedInRankings = rankingsPlayers.find(
              (pl: any) => cleanPlayerName(pl.name) === cleanPlayerName(name) && pl.position.toUpperCase() === position
            );
            if (matchedInRankings) {
              playerMap.set(p.playerId, matchedInRankings.id);
              playerRecordsMap.set(matchedInRankings.id, matchedInRankings);
              continue;
            }

            // 3. Try matching by name and position in existingPlayersByName using cleanPlayerName (for other database matches)
            const matchedByName = existingPlayersByName.find(
              (pl) => cleanPlayerName(pl.name) === cleanPlayerName(name) && pl.position.toUpperCase() === position
            );
            if (matchedByName) {
              playerMap.set(p.playerId, matchedByName.id);
              playerRecordsMap.set(matchedByName.id, matchedByName);
              continue;
            }
          }

          const missingPlayersData = [];
          const processedPlayerIds = new Set();
          for (const p of newPicks) {
            if (!playerMap.has(p.playerId) && !processedPlayerIds.has(p.playerId)) {
              const pMetadata = p.metadata || {};
              const newPlayer = {
                id: p.playerId,
                name: `${pMetadata.first_name || ""} ${pMetadata.last_name || "Unknown Player"}`.trim() || "Sleeper Player",
                position: pMetadata.position || "RB",
                nflTeam: pMetadata.team || "FA",
                byeWeek: 0,
              };
              missingPlayersData.push(newPlayer);
              processedPlayerIds.add(p.playerId);
              playerMap.set(p.playerId, p.playerId);
              playerRecordsMap.set(p.playerId, newPlayer);
            }
          }

          if (missingPlayersData.length > 0) {
            await prisma.player.createMany({
              data: missingPlayersData,
              skipDuplicates: true,
            });
          }

          const picksToCreate = [];
          const rostersToCreate = [];

          for (const p of newPicks) {
            let teamDbId = teamMappings[p.teamId] || teamMappings[`roster-${p.teamId}`];
            if (!teamDbId && p.rosterId) {
              const matchedTeam = teams.find((t: any) => {
                const rId = parseInt(t.externalTeamId?.replace("mock-team-", "") || t.externalTeamId?.replace("roster-", "") || "");
                return rId === p.rosterId;
              });
              teamDbId = matchedTeam?.id;
            }
            if (!teamDbId && p.rosterId) {
              const matchedTeam = teams.find((t: any) => t.draftPosition === p.rosterId);
              teamDbId = matchedTeam?.id;
            }
            if (!teamDbId) {
              const slot = p.pickNumber % teams.length || teams.length;
              const matchedTeam = teams.find((t: any) => t.draftPosition === slot);
              teamDbId = matchedTeam?.id;
            }

            if (teamDbId) {
              const dbPlayerId = playerMap.get(p.playerId) || p.playerId;

              picksToCreate.push({
                draftId: dbDraft.id,
                pickNumber: p.pickNumber,
                roundNumber: p.roundNumber,
                teamId: teamDbId,
                playerId: dbPlayerId,
                source: "sleeper",
              });

              const pDetails = playerRecordsMap.get(dbPlayerId);
              const pPosition = pDetails?.position || "RB";

              rostersToCreate.push({
                leagueId: league.id,
                teamId: teamDbId,
                playerId: dbPlayerId,
                rosterPosition: pPosition,
              });
            }
          }

          if (picksToCreate.length > 0) {
            await prisma.draftPick.createMany({ data: picksToCreate });
          }
          if (rostersToCreate.length > 0) {
            await prisma.roster.createMany({ data: rostersToCreate });
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
