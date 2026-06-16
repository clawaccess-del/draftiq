import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { SleeperAdapter } from "@/lib/integrations/sleeper-adapter";
import { getDefaultOfflinePlayers } from "@/lib/integrations/default-players";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { leagueId, draftId, userSleeperId } = data;
    let resolvedUserSleeperId = userSleeperId;

    const adapter = new SleeperAdapter();
    let leagueDetails: any;
    let sleeperTeams: any[] = [];
    let activeSleeperDraft: any;
    let finalDraftId: string;
    let finalLeagueId: string;

    if (leagueId) {
      leagueDetails = await adapter.getLeagueSettings(leagueId);
      sleeperTeams = await adapter.getTeams(leagueId);
      
      const draftsList = await adapter.getDrafts(leagueId);
      activeSleeperDraft = draftsList[0] || {
        draft_id: leagueDetails.raw?.draft_id,
        status: "pre_draft",
        settings: { rounds: 15 },
      };
      finalDraftId = activeSleeperDraft.draft_id;
      finalLeagueId = leagueId;
    } else if (draftId) {
      // Standalone Draft ID (Mock Draft) sync
      const draftInfo = await adapter.getDraftDetails(draftId);
      
      const settings = {
        QB: draftInfo.settings.slots_qb || 0,
        RB: draftInfo.settings.slots_rb || 0,
        WR: draftInfo.settings.slots_wr || 0,
        TE: draftInfo.settings.slots_te || 0,
        FLEX: draftInfo.settings.slots_flex || 0,
        SUPERFLEX: draftInfo.settings.slots_super_flex || draftInfo.settings.slots_superflex || 0,
        K: draftInfo.settings.slots_k || 0,
        DST: draftInfo.settings.slots_def || 0,
        BENCH: draftInfo.settings.slots_bn || 0,
      };
      
      const hasSlots = Object.values(settings).some((v) => v > 0);
      const rosterSettings = hasSlots ? settings : { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1, BENCH: 6 };
      
      leagueDetails = {
        name: draftInfo.metadata?.name || `Sleeper Mock Draft (${draftId.slice(0, 6)})`,
        platform: "sleeper",
        scoringType: draftInfo.metadata?.scoring_type || "ppr",
        teamCount: draftInfo.settings.teams || 12,
        draftType: draftInfo.type || "snake",
        rosterSettings,
        raw: draftInfo,
      };

      // Determine the user's Sleeper ID fallback if userSleeperId is missing
      resolvedUserSleeperId = userSleeperId;
      if (!resolvedUserSleeperId && draftInfo.draft_order) {
        const userIds = Object.keys(draftInfo.draft_order);
        if (userIds.length > 0) {
          resolvedUserSleeperId = userIds[0];
        }
      }

      const totalTeams = draftInfo.settings.teams || 12;
      let hasUserTeam = false;

      if (resolvedUserSleeperId) {
        for (let slot = 1; slot <= totalTeams; slot++) {
          const userId = Object.keys(draftInfo.draft_order || {}).find(
            (key) => draftInfo.draft_order[key] === slot
          );
          if (userId === resolvedUserSleeperId) {
            hasUserTeam = true;
            break;
          }
        }
      }

      for (let slot = 1; slot <= totalTeams; slot++) {
        const userId = Object.keys(draftInfo.draft_order || {}).find(
          (key) => draftInfo.draft_order[key] === slot
        );
        const isUser = (resolvedUserSleeperId && userId === resolvedUserSleeperId) || (!hasUserTeam && slot === 1);
        let name = `Team ${slot}`;
        let ownerName = `CPU`;
        
        if (userId) {
          if (isUser) {
            name = "My Team";
            ownerName = "User";
          } else {
            name = `Opponent ${slot}`;
            ownerName = `User ${userId.slice(0, 5)}`;
          }
        } else if (isUser) {
          name = "My Team";
          ownerName = "User";
        }
        
        sleeperTeams.push({
          id: userId || `mock-team-${slot}`,
          rosterId: slot,
          name,
          ownerName,
          draftPosition: slot,
          isUserTeam: isUser,
          externalTeamId: userId || null,
        });
      }

      activeSleeperDraft = draftInfo;
      finalDraftId = draftId;
      finalLeagueId = `mock-${draftId}`;
    } else {
      return NextResponse.json({ error: "League ID or Draft ID is required" }, { status: 400 });
    }

    const totalRounds = activeSleeperDraft.settings?.rounds || Object.values(leagueDetails.rosterSettings).reduce((a: any, b: any) => a + b, 0);
    const sleeperPicks = await adapter.getDraftPicks(finalDraftId);

    const email = session.user.email as string;

    try {
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: session.user.name || "Draft Master",
          },
        });
      }

      // Create league, teams, drafts, and picks in DB
      const result = await prisma.$transaction(async (tx: any) => {
        // Create League
        const league = await tx.league.create({
          data: {
            userId: user.id,
            name: leagueDetails.name,
            platform: "sleeper",
            externalLeagueId: finalLeagueId,
            scoringType: leagueDetails.scoringType,
            teamCount: leagueDetails.teamCount,
            draftType: leagueDetails.draftType,
            rosterSettingsJson: leagueDetails.rosterSettings,
          },
        });

        // Seed default players and rankings for the new league
        const defaultPlayers = getDefaultOfflinePlayers();
        for (const dp of defaultPlayers) {
          // Find or create Player
          let player = await tx.player.findFirst({
            where: {
              name: { equals: dp.name, mode: "insensitive" },
              position: { equals: dp.position, mode: "insensitive" },
            },
          });

          if (!player) {
            player = await tx.player.create({
              data: {
                id: dp.id,
                name: dp.name,
                position: dp.position,
                nflTeam: dp.nflTeam,
                byeWeek: dp.byeWeek,
              },
            });
          }

          // Create PlayerRanking for this league
          await tx.playerRanking.create({
            data: {
              playerId: player.id,
              leagueId: league.id,
              source: "default",
              overallRank: dp.overallRank,
              positionRank: dp.positionRank,
              projectedPoints: dp.projectedPoints,
              adp: dp.adp,
              tier: dp.tier,
              riskScore: dp.riskScore,
              notes: dp.notes,
            },
          });
        }

        // Create Teams
        const teamMappings: Record<string, string> = {};
        for (const t of sleeperTeams) {
          const isUser = t.isUserTeam || (resolvedUserSleeperId && t.externalTeamId === resolvedUserSleeperId);
          const createdTeam = await tx.team.create({
            data: {
              leagueId: league.id,
              name: t.name,
              ownerName: t.ownerName,
              draftPosition: t.draftPosition,
              isUserTeam: isUser,
              externalTeamId: t.externalTeamId || `mock-team-${t.rosterId}`,
            },
          });
          teamMappings[t.externalTeamId || `roster-${t.rosterId}`] = createdTeam.id;
          teamMappings[`mock-team-${t.rosterId}`] = createdTeam.id;
        }

        // Create Draft
        const currentPickNumber = sleeperPicks.length + 1;
        const draftStatus = activeSleeperDraft.status === "complete" ? "completed" : activeSleeperDraft.status === "paused" ? "paused" : "active";

        const createdDraft = await tx.draft.create({
          data: {
            leagueId: league.id,
            status: draftStatus,
            currentPickNumber,
            totalRounds,
            draftType: leagueDetails.draftType,
          },
        });

        // Insert picks if Sleeper draft already has picks
        for (const p of sleeperPicks) {
          let player = await tx.player.findFirst({
            where: { id: p.playerId },
          });

          if (!player) {
            const pMetadata = p.metadata || {};
            player = await tx.player.create({
              data: {
                id: p.playerId,
                name: `${pMetadata.first_name || ""} ${pMetadata.last_name || "Unknown Player"}`.trim() || "Sleeper Player",
                position: pMetadata.position || "RB",
                nflTeam: pMetadata.team || "FA",
                byeWeek: 0,
              },
            });
          }

          const teamDbId = teamMappings[p.teamId] || teamMappings[`mock-team-${p.teamId}`] || teamMappings[p.teamId];
          if (teamDbId) {
            await tx.draftPick.create({
              data: {
                draftId: createdDraft.id,
                pickNumber: p.pickNumber,
                roundNumber: p.roundNumber,
                teamId: teamDbId,
                playerId: player.id,
                source: "sleeper",
              },
            });

            await tx.roster.create({
              data: {
                leagueId: league.id,
                teamId: teamDbId,
                playerId: player.id,
                rosterPosition: player.position,
              },
            });
          }
        }

        return { leagueId: league.id, draftId: createdDraft.id };
      });

      return NextResponse.json({
        success: true,
        leagueId: result.leagueId,
        draftId: result.draftId,
        message: "Sleeper draft/mock sync successfully saved to database.",
      });
    } catch (dbError) {
      console.warn("Database connection missing. Processing Sleeper link offline.", dbError);

      const mockLeagueId = `sleeper-league-${finalLeagueId}`;
      const mockDraftId = `sleeper-draft-${finalDraftId}`;

      return NextResponse.json({
        success: true,
        offline: true,
        leagueId: mockLeagueId,
        draftId: mockDraftId,
        leagueDetails: {
          name: leagueDetails.name,
          platform: "sleeper",
          scoringType: leagueDetails.scoringType,
          teamCount: leagueDetails.teamCount,
          draftType: leagueDetails.draftType,
          rosterSettings: leagueDetails.rosterSettings,
          teams: sleeperTeams.map((t) => ({
            id: t.externalTeamId || `mock-team-${t.rosterId}`,
            name: t.name,
            ownerName: t.ownerName,
            draftPosition: t.draftPosition,
            isUserTeam: t.isUserTeam,
          })),
          picks: sleeperPicks,
        },
        message: "Offline sync active. Standalone draft settings loaded from Sleeper API.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to link Sleeper draft" }, { status: 500 });
  }
}
