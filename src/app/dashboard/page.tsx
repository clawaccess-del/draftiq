export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Plus, Settings, Play, CheckCircle2, AlertTriangle, LogOut } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import SleeperImporter from "./SleeperImporter";
import ActiveLeaguesList from "./ActiveLeaguesList";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const email = session.user.email as string;
  let leagues: any[] = [];
  let dbConnected = true;
  let sleeperUsername = "";

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
      sleeperUsername = user.sleeperUsername || "";
    }
  } catch (error) {
    console.error("Database connection error in dashboard:", error);
    dbConnected = false;
    leagues = [];
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Leagues List Grid */}
          <div className="lg:col-span-8 space-y-4">
            <h3 className="text-lg font-bold text-slate-200 tracking-tight">Active Leagues</h3>
            <ActiveLeaguesList initialLeagues={leagues} dbConnected={dbConnected} />
          </div>

          {/* Sleeper Sidebar */}
          <div className="lg:col-span-4">
            <SleeperImporter defaultUsername={sleeperUsername} />
          </div>
        </div>
      </main>
    </div>
  );
}
