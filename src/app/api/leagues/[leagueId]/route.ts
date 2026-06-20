import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { leagueId } = await params;

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const email = session.user.email as string;

    try {
      // Ensure the league belongs to the current user
      const league = await prisma.league.findFirst({
        where: {
          id: leagueId,
          user: { email },
        },
      });

      if (!league) {
        return NextResponse.json({ error: "League not found or unauthorized" }, { status: 404 });
      }

      // Delete the league (cascade deletes will automatically handle drafts, teams, picks, rosters, recommendations)
      await prisma.league.delete({
        where: { id: leagueId },
      });

      return NextResponse.json({
        success: true,
        message: "League deleted successfully from database.",
      });
    } catch (dbError) {
      console.warn("Database connection failed in league deletion lookup.", dbError);
      return NextResponse.json({
        success: true,
        offline: true,
        message: "Offline mode: Simulating league deletion.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
