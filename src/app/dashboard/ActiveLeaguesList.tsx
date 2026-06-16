"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Play, CheckCircle2, Trash2, ArrowRight, Sparkles } from "lucide-react";

interface Draft {
  id: string;
  status: string;
  currentPickNumber: number;
  totalRounds: number;
}

interface League {
  id: string;
  name: string;
  platform: string;
  scoringType: string;
  teamCount: number;
  draftType: string;
  createdAt: string | Date;
  drafts: Draft[];
  isOffline?: boolean;
}

interface ActiveLeaguesListProps {
  initialLeagues: League[];
  dbConnected: boolean;
}

export default function ActiveLeaguesList({ initialLeagues, dbConnected }: ActiveLeaguesListProps) {
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);

  useEffect(() => {
    // Read offline leagues from localStorage
    const storedOffline = typeof window !== "undefined" ? localStorage.getItem("offline_leagues") : null;
    const offlineLeagues: League[] = storedOffline ? JSON.parse(storedOffline) : [];

    // Tag them as offline/sandbox
    const taggedOffline = offlineLeagues.map((l) => ({ ...l, isOffline: true }));

    // Merge: database leagues first. If DB is offline, initialLeagues are the hardcoded mock ones.
    // If DB is offline, we'll keep the hardcoded ones as fallback, but prepend the real user offline leagues!
    const merged = [...initialLeagues];
    
    // Prepend offline leagues to the list (user-created sandbox data is more important than hardcoded mocks)
    taggedOffline.forEach((offLeague) => {
      if (!merged.some((l) => l.id === offLeague.id)) {
        // Find if it's replacing a hardcoded mock league (e.g. if they had the same ID somehow, though IDs are unique)
        merged.unshift(offLeague);
      }
    });

    setLeagues(merged);
  }, [initialLeagues]);

  const handleDeleteOfflineLeague = (leagueId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this sandbox league and all its draft picks?")) {
      return;
    }

    const storedOffline = typeof window !== "undefined" ? localStorage.getItem("offline_leagues") : null;
    if (storedOffline) {
      const offlineLeagues: League[] = JSON.parse(storedOffline);
      const filtered = offlineLeagues.filter((l) => l.id !== leagueId);
      localStorage.setItem("offline_leagues", JSON.stringify(filtered));
      
      // Update state
      setLeagues((prev) => prev.filter((l) => l.id !== leagueId));
    }
  };

  if (leagues.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl space-y-4">
        <Trophy className="h-12 w-12 text-slate-700 mx-auto" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-400">No leagues found</p>
          <p className="text-xs text-slate-600">Sync a Sleeper league/mock, or create a new league setup.</p>
        </div>
        <Link
          href="/leagues/new"
          className="inline-flex items-center text-xs font-bold text-emerald-400 hover:underline"
        >
          Set up a league now →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {leagues.map((league) => {
        const activeDraft = league.drafts?.find((d: any) => d.status === "active" || d.status === "paused");
        const completedDraft = league.drafts?.find((d: any) => d.status === "completed");
        const latestDraft = activeDraft || completedDraft || league.drafts?.[0];

        return (
          <div
            key={league.id}
            className={`group bg-slate-900/40 border rounded-2xl p-6 transition-all hover:shadow-lg flex flex-col justify-between relative overflow-hidden ${
              league.isOffline 
                ? "border-emerald-500/20 hover:border-emerald-500/40" 
                : "border-slate-900 hover:border-slate-800"
            }`}
          >
            {/* Ambient indicator for sandbox drafts */}
            {league.isOffline && (
              <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-emerald-500/5 rounded-full blur-[30px] pointer-events-none" />
            )}

            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-900">
                      {league.platform === "manual" ? "Manual Tracker" : league.platform}
                    </span>
                    {league.isOffline && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
                        <Sparkles className="h-2.5 w-2.5" />
                        Sandbox
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {league.name}
                  </h4>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500 font-medium">
                    {new Date(league.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {league.isOffline && (
                    <button
                      onClick={(e) => handleDeleteOfflineLeague(league.id, e)}
                      className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all border border-transparent hover:border-red-900/30"
                      title="Delete sandbox league"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 py-3 border-y border-slate-900/60 text-center text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">Format</p>
                  <p className="font-semibold text-slate-300 uppercase">{league.scoringType?.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">Teams</p>
                  <p className="font-semibold text-slate-300">{league.teamCount} Teams</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">Draft Type</p>
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
                  <span className="inline-flex items-center text-xs text-slate-500 font-semibold bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-900">
                    Setup Mode
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {latestDraft?.status === "completed" ? (
                  <Link
                    href={`/drafts/${latestDraft.id}/report`}
                    className="inline-flex items-center justify-center py-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all"
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
                    className="inline-flex items-center justify-center py-2 px-3.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 hover:border-emerald-500 rounded-xl text-xs font-bold transition-all"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    {latestDraft ? "Enter Room" : "Import"}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
