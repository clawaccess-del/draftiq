import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Plus, Settings, Play, CheckCircle2, AlertTriangle, LogOut } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const email = session.user.email as string;
  let leagues: any[] = [];
  let dbConnected = true;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        leagues: {
          include: {
            drafts: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (user) {
      leagues = user.leagues;
    }
  } catch (error) {
    console.error("Database connection error in dashboard:", error);
    dbConnected = false;
    // Fallback mock data for offline testing
    leagues = [
      {
        id: "mock-league-1",
        name: "Apex Predator Dynasty",
        platform: "manual",
        scoringType: "ppr",
        teamCount: 12,
        draftType: "snake",
        createdAt: new Date("2026-06-01"),
        drafts: [
          {
            id: "mock-draft-1",
            status: "active",
            currentPickNumber: 42,
            totalRounds: 15,
          },
        ],
      },
      {
        id: "mock-league-2",
        name: "Sleeper Mega League",
        platform: "sleeper",
        scoringType: "half_ppr",
        teamCount: 10,
        draftType: "snake",
        createdAt: new Date("2026-05-15"),
        drafts: [
          {
            id: "mock-draft-2",
            status: "completed",
            currentPickNumber: 150,
            totalRounds: 15,
          },
        ],
      },
    ];
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/10">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Draft<span className="text-emerald-400">IQ</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Welcome back</p>
              <p className="text-sm font-medium text-slate-200">{session.user.name}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!dbConnected && (
          <div className="p-4 bg-amber-950/40 border border-amber-900/60 rounded-2xl flex items-start gap-3 text-amber-200">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-400 shrink-0" />
            <div className="text-sm">
              <h4 className="font-bold mb-0.5">Database Not Connected</h4>
              <p className="text-amber-300/80 leading-relaxed">
                Prisma client could not connect to PostgreSQL. We are showing mock local storage/offline leagues for review. 
                Please set a valid `DATABASE_URL` in your environment variables to save settings.
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="space-y-2 relative z-10">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Your Draft Room</h2>
            <p className="text-slate-400 text-sm max-w-md">
              Create leagues, upload player projections, and launch your draft assistant with real-time picks co-pilot.
            </p>
          </div>
          <Link
            href="/leagues/new"
            className="inline-flex items-center justify-center py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all relative z-10"
          >
            <Plus className="h-4 w-4 mr-2 stroke-[3]" />
            New League Setup
          </Link>
        </div>

        {/* Leagues List Grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-200 tracking-tight">Active Leagues</h3>

          {leagues.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl space-y-4">
              <Trophy className="h-12 w-12 text-slate-700 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-400">No leagues found</p>
                <p className="text-xs text-slate-600">Create your first fantasy football league to begin.</p>
              </div>
              <Link
                href="/leagues/new"
                className="inline-flex items-center text-xs font-bold text-emerald-400 hover:underline"
              >
                Set up a league now →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {leagues.map((league) => {
                const activeDraft = league.drafts.find((d: any) => d.status === "active" || d.status === "paused");
                const completedDraft = league.drafts.find((d: any) => d.status === "completed");
                const latestDraft = activeDraft || completedDraft || league.drafts[0];

                return (
                  <div
                    key={league.id}
                    className="group bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl p-6 transition-all hover:shadow-lg flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-800 mb-2">
                            {league.platform === "manual" ? "Manual Tracker" : league.platform}
                          </span>
                          <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {league.name}
                          </h4>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {new Date(league.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 py-3 border-y border-slate-900/60 text-center text-xs">
                        <div>
                          <p className="text-slate-500 font-medium uppercase tracking-wider text-2xs mb-0.5">Format</p>
                          <p className="font-semibold text-slate-300 uppercase">{league.scoringType.replace("_", " ")}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium uppercase tracking-wider text-2xs mb-0.5">Teams</p>
                          <p className="font-semibold text-slate-300">{league.teamCount} Teams</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium uppercase tracking-wider text-2xs mb-0.5">Draft Type</p>
                          <p className="font-semibold text-slate-300 capitalize">{league.draftType}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        {latestDraft?.status === "active" || latestDraft?.status === "paused" ? (
                          <span className="inline-flex items-center text-xs text-emerald-400 font-semibold gap-1 bg-emerald-950/20 border border-emerald-900/40 px-2.5 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live (Pick {latestDraft.currentPickNumber})
                          </span>
                        ) : latestDraft?.status === "completed" ? (
                          <span className="inline-flex items-center text-xs text-slate-400 font-semibold gap-1 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                            Draft Finished
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs text-slate-500 font-semibold bg-slate-950 px-2.5 py-0.5 rounded-full">
                            Setup Mode
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {latestDraft?.status === "completed" ? (
                          <Link
                            href={`/drafts/${latestDraft.id}/report`}
                            className="inline-flex items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all"
                            title="View Report Card"
                          >
                            Report Card
                          </Link>
                        ) : (
                          <Link
                            href={
                              latestDraft
                                ? `/drafts/${latestDraft.id}`
                                : `/leagues/${league.id}/import`
                            }
                            className="inline-flex items-center justify-center py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 hover:border-emerald-500 rounded-xl text-xs font-bold transition-all"
                          >
                            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                            {latestDraft ? "Enter Draft Room" : "Import Rankings"}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
