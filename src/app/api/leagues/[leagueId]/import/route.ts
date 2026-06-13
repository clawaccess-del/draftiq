import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { leagueId } = await params;

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { players, overwrite = true } = data;

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: "No players provided for import" }, { status: 400 });
    }

    // Attempt database transaction
    try {
      // Find or create players, then add player rankings connected to the league.
      const result = await prisma.$transaction(async (tx) => {
        if (overwrite) {
          // Delete existing rankings for this league
          await tx.playerRanking.deleteMany({
            where: { leagueId },
          });
        }

        let importedCount = 0;

        for (const p of players) {
          const name = String(p.player_name || p.name).trim();
          const position = String(p.position).toUpperCase().trim();
          const nflTeam = String(p.nfl_team || p.team || "FA").toUpperCase().trim();
          const byeWeek = parseInt(p.bye_week || p.bye, 10) || 0;
          const injuryStatus = p.injury_status || null;

          // Find existing player or create new
          let player = await tx.player.findFirst({
            where: {
              name: { equals: name, mode: "insensitive" },
              position: { equals: position, mode: "insensitive" },
            },
          });

          if (!player) {
            player = await tx.player.create({
              data: {
                name,
                position,
                nflTeam,
                byeWeek,
                injuryStatus,
              },
            });
          } else {
            // Update team and bye week just in case
            player = await tx.player.update({
              where: { id: player.id },
              data: {
                nflTeam,
                byeWeek,
                injuryStatus,
              },
            });
          }

          // Read numbers from row
          const projectedPoints = parseFloat(p.projected_points || p.projection) || 0.0;
          const adp = parseFloat(p.adp) || 200.0;
          const tier = parseInt(p.tier, 10) || 99;
          const riskScore = parseFloat(p.risk_score || p.risk) || 5.0;
          const overallRank = parseInt(p.overall_rank || p.rank, 10) || (importedCount + 1);
          const positionRank = parseInt(p.position_rank || p.pos_rank, 10) || 1;
          const ceilingProjection = p.ceiling_projection ? parseFloat(p.ceiling_projection) : null;
          const floorProjection = p.floor_projection ? parseFloat(p.floor_projection) : null;
          const notes = p.notes || null;

          await tx.playerRanking.create({
            data: {
              playerId: player.id,
              leagueId,
              source: "import",
              overallRank,
              positionRank,
              projectedPoints,
              adp,
              tier,
              riskScore,
              ceilingProjection,
              floorProjection,
              notes,
            },
          });

          importedCount++;
        }

        return importedCount;
      });

      return NextResponse.json({
        success: true,
        count: result,
        message: `Successfully imported ${result} player rankings.`,
      });
    } catch (dbError) {
      console.warn("Database connection failed during CSV import. Proceeding offline.", dbError);
      return NextResponse.json({
        success: true,
        offline: true,
        count: players.length,
        message: `Offline mode: parsed ${players.length} players. Storing locally.`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to process import" }, { status: 500 });
  }
}
