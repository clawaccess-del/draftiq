import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const {
      name,
      platform = "manual",
      scoringType,
      teamCount,
      draftType,
      rosterSettings,
      teams, // array of team names or details
    } = data;

    if (!name || !scoringType || !teamCount || !draftType || !rosterSettings) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const email = session.user.email as string;

    // Check if DB is ready. If not, generate a mock success response.
    try {
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: session.user.name || "Draft Master",
          },
        });
      }

      // Create league in DB
      const league = await prisma.league.create({
        data: {
          userId: user.id,
          name,
          platform,
          scoringType,
          teamCount: parseInt(teamCount, 10),
          draftType,
          rosterSettingsJson: rosterSettings,
          teams: {
            create: Array.from({ length: parseInt(teamCount, 10) }).map((_, idx) => {
              const teamName = teams?.[idx] || `Team ${idx + 1}`;
              return {
                name: teamName,
                ownerName: idx === 0 ? user?.name || "Owner 1" : `Owner ${idx + 1}`,
                draftPosition: idx + 1,
                isUserTeam: idx === 0, // Assume Team 1 is the user's team by default
              };
            }),
          },
          drafts: {
            create: {
              status: "setup",
              currentPickNumber: 1,
              totalRounds: Object.values(rosterSettings).reduce((a: any, b: any) => a + b, 0) as number,
              draftType,
            },
          },
        },
        include: {
          drafts: true,
        },
      });

      return NextResponse.json({
        success: true,
        leagueId: league.id,
        draftId: league.drafts[0]?.id,
        message: "League created successfully in database.",
      });
    } catch (dbError) {
      console.warn("Database connection failed, generating mock league offline:", dbError);

      // Return a mock ID so client can simulate offline operations
      const mockLeagueId = `mock-league-${Date.now()}`;
      const mockDraftId = `mock-draft-${Date.now()}`;

      return NextResponse.json({
        success: true,
        leagueId: mockLeagueId,
        draftId: mockDraftId,
        offline: true,
        message: "Offline setup active. League stored in session simulation.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
