import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { SleeperAdapter } from "@/lib/integrations/sleeper-adapter";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: "Sleeper username is required" }, { status: 400 });
    }

    const adapter = new SleeperAdapter();
    const user = await adapter.getUser(username);
    const leagues = await adapter.getLeagues(user.user_id);

    return NextResponse.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar,
      },
      leagues: leagues.map((l: any) => ({
        leagueId: l.league_id,
        name: l.name,
        season: l.season,
        status: l.status,
        teamCount: l.total_rosters,
        draftId: l.draft_id,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to import leagues from Sleeper" }, { status: 500 });
  }
}
