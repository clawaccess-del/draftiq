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
    const { userPosition } = await req.json();

    if (!userPosition) {
      return NextResponse.json({ error: "User position is required" }, { status: 400 });
    }

    const draft = await prisma.draft.findUnique({
      where: { id: draftId },
      select: { leagueId: true },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Set isUserTeam = false for all teams in the league, and isUserTeam = true for the team at userPosition
    await prisma.$transaction([
      prisma.team.updateMany({
        where: { leagueId: draft.leagueId },
        data: { isUserTeam: false },
      }),
      prisma.team.updateMany({
        where: { leagueId: draft.leagueId, draftPosition: userPosition },
        data: { isUserTeam: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
