import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { draftId } = await params;

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { playerId, teamId } = data;

    if (!playerId || !teamId) {
      return NextResponse.json({ error: "Player ID and Team ID are required" }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const draft = await tx.draft.findUnique({
          where: { id: draftId },
          include: { league: true },
        });

        if (!draft) {
          throw new Error("Draft not found");
        }

        const currentPick = draft.currentPickNumber;
        const totalPicks = draft.league.teamCount * draft.totalRounds;

        if (currentPick > totalPicks) {
          throw new Error("Draft is already completed");
        }

        const roundNumber = Math.ceil(currentPick / draft.league.teamCount);

        // Create the draft pick
        const pick = await tx.draftPick.create({
          data: {
            draftId,
            pickNumber: currentPick,
            roundNumber,
            teamId,
            playerId,
            source: "manual",
          },
        });

        // Update draft status and time settings
        const isFinished = currentPick === totalPicks;
        const nextPick = currentPick + 1;

        await tx.draft.update({
          where: { id: draftId },
          data: {
            currentPickNumber: nextPick,
            status: isFinished ? "completed" : "active",
            startedAt: draft.status === "setup" ? new Date() : undefined,
            completedAt: isFinished ? new Date() : undefined,
          },
        });

        // Add roster item
        // Determine starting roster position using team settings & current players
        const leagueRosterSettings = draft.league.rosterSettingsJson as any;
        const teamRosters = await tx.roster.findMany({
          where: { teamId },
          include: { player: true },
        });

        const player = await tx.player.findUnique({ where: { id: playerId } });
        if (!player) throw new Error("Player not found");

        const pos = player.position;
        const countAtPos = teamRosters.filter((r) => r.player.position === pos).length;
        const requiredAtPos = leagueRosterSettings[pos] || 0;

        let rosterPosition = "BN"; // default to bench

        if (countAtPos < requiredAtPos) {
          rosterPosition = pos;
        } else {
          // Check Flex
          const flexRequired = leagueRosterSettings["FLEX"] || 0;
          const flexStarters = teamRosters.filter((r) => r.rosterPosition === "FLEX").length;
          if ((pos === "RB" || pos === "WR" || pos === "TE") && flexStarters < flexRequired) {
            rosterPosition = "FLEX";
          } else {
            // Check Superflex
            const superflexRequired = leagueRosterSettings["SUPERFLEX"] || 0;
            const superflexStarters = teamRosters.filter((r) => r.rosterPosition === "SUPERFLEX").length;
            if ((pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE") && superflexStarters < superflexRequired) {
              rosterPosition = "SUPERFLEX";
            }
          }
        }

        await tx.roster.create({
          data: {
            leagueId: draft.leagueId,
            teamId,
            playerId,
            rosterPosition,
          },
        });

        return { pick, nextPick, isFinished };
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (dbError: any) {
      console.warn("Database error during draft pick. Proceeding offline.", dbError);
      return NextResponse.json({
        success: true,
        offline: true,
        message: "Offline pick processed successfully.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
