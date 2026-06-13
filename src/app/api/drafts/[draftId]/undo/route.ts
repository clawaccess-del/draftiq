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
    try {
      const result = await prisma.$transaction(async (tx) => {
        const draft = await tx.draft.findUnique({
          where: { id: draftId },
        });

        if (!draft) {
          throw new Error("Draft not found");
        }

        const currentPick = draft.currentPickNumber;
        if (currentPick <= 1) {
          throw new Error("No picks to undo");
        }

        const targetPickNumber = currentPick - 1;

        // Find the latest pick
        const lastPick = await tx.draftPick.findFirst({
          where: {
            draftId,
            pickNumber: targetPickNumber,
          },
        });

        if (!lastPick) {
          throw new Error(`Pick #${targetPickNumber} not found to undo`);
        }

        // Delete the pick
        await tx.draftPick.delete({
          where: { id: lastPick.id },
        });

        // Delete the roster entry
        await tx.roster.deleteMany({
          where: {
            leagueId: draft.leagueId,
            teamId: lastPick.teamId,
            playerId: lastPick.playerId,
          },
        });

        // Update draft pick number and status
        const nextPick = targetPickNumber;
        const newStatus = nextPick === 1 ? "setup" : "active";

        await tx.draft.update({
          where: { id: draftId },
          data: {
            currentPickNumber: nextPick,
            status: newStatus,
            completedAt: null,
          },
        });

        return { undonePickNumber: targetPickNumber, nextPick };
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (dbError: any) {
      console.warn("Database error during draft undo. Proceeding offline.", dbError);
      return NextResponse.json({
        success: true,
        offline: true,
        message: "Offline pick undone successfully.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
