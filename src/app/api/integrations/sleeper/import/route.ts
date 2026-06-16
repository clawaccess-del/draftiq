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

    // Fetch user drafts for both 2026 and 2025
    const currentYear = new Date().getFullYear();
    const [drafts2026, drafts2025] = await Promise.all([
      adapter.getUserDrafts(user.user_id, currentYear.toString()),
      adapter.getUserDrafts(user.user_id, (currentYear - 1).toString()),
    ]);

    const allDrafts = [...drafts2026, ...drafts2025];

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
      drafts: allDrafts.map((d: any) => ({
        draftId: d.draft_id,
        leagueId: d.league_id,
        status: d.status,
        type: d.type,
        season: d.season,
        teams: d.settings?.teams || 12,
        rounds: d.settings?.rounds || 15,
        name: d.metadata?.name || `Mock Draft ${d.draft_id.slice(0, 6)}`,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to import leagues from Sleeper" }, { status: 500 });
  }
}
