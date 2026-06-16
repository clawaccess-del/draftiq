import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { SleeperAdapter } from "@/lib/integrations/sleeper-adapter";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { leagueId, userSleeperId } = data;

    if (!leagueId) {
      return NextResponse.json({ error: "League ID is required" }, { status: 400 });
    }

    const adapter = new SleeperAdapter();
    const leagueDetails = await adapter.getLeagueSettings(leagueId);
    const sleeperTeams = await adapter.getTeams(leagueId);
    
    // Get drafts for this league from Sleeper
    const draftsList = await adapter.getDrafts(leagueId);
    const activeSleeperDraft = draftsList[0] || {
      draft_id: leagueDetails.raw?.draft_id,
      status: "pre_draft",
      settings: { rounds: 15 },
    };

    const draftId = activeSleeperDraft.draft_id;
    const totalRounds = activeSleeperDraft.settings?.rounds || Object.values(leagueDetails.rosterSettings).reduce((a: any, b: any) => a + b, 0);

    // Fetch active picks from Sleeper
    const sleeperPicks = await adapter.getDraftPicks(draftId);

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
            externalLeagueId: leagueId,
            scoringType: leagueDetails.scoringType,
            teamCount: leagueDetails.teamCount,
            draftType: leagueDetails.draftType,
            rosterSettingsJson: leagueDetails.rosterSettings,
          },
        });

        // Create Teams
        const teamMappings: Record<string, string> = {};
        for (const t of sleeperTeams) {
          const isUser = t.externalTeamId === userSleeperId;
          const createdTeam = await tx.team.create({
            data: {
              leagueId: league.id,
              name: t.name,
              ownerName: t.ownerName,
              draftPosition: t.draftPosition,
              isUserTeam: isUser,
              externalTeamId: t.externalTeamId,
            },
          });
          teamMappings[t.externalTeamId || `roster-${t.rosterId}`] = createdTeam.id;
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
          // Find or create player locally
          let player = await tx.player.findFirst({
            where: { id: p.playerId },
          });

          if (!player) {
            // Sleeper player needs mapping, create standard profile fallback
            // In a real environment, we'd import/map sleeper players, but here we dynamically initialize it
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

          const teamDbId = teamMappings[p.teamId];
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

            // Add to roster
            await tx.roster.create({
              data: {
                leagueId: league.id,
                teamId: teamDbId,
                playerId: player.id,
                rosterPosition: player.position, // simple position starter mapping
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
        message: "Sleeper league successfully synced and saved to database.",
      });
    } catch (dbError) {
      console.warn("Database connection missing. Processing Sleeper link offline.", dbError);

      const mockLeagueId = `sleeper-league-${leagueId}`;
      const mockDraftId = `sleeper-draft-${draftId || "123"}`;

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
            id: t.externalTeamId || `team-${t.rosterId}`,
            name: t.name,
            ownerName: t.ownerName,
            draftPosition: t.draftPosition,
            isUserTeam: t.externalTeamId === userSleeperId,
          })),
          picks: sleeperPicks,
        },
        message: "Offline sync active. League settings loaded from Sleeper API.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to link Sleeper league" }, { status: 500 });
  }
}
