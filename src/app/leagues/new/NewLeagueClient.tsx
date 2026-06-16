"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Settings, Users, ArrowLeft, Loader2, Plus, Minus, Info } from "lucide-react";
import Link from "next/link";

interface RosterSettings {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX: number;
  K: number;
  DST: number;
  BENCH: number;
}

export default function NewLeagueClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [teamCount, setTeamCount] = useState(12);
  const [scoringType, setScoringType] = useState("ppr");
  const [draftType, setDraftType] = useState("snake");

  const [roster, setRoster] = useState<RosterSettings>({
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    SUPERFLEX: 0,
    K: 1,
    DST: 1,
    BENCH: 6,
  });

  const [teams, setTeams] = useState<string[]>(
    Array.from({ length: 12 }).map((_, idx) => (idx === 0 ? "My Team" : `Team ${idx + 1}`))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTeamCountChange = (newCount: number) => {
    if (newCount < 4 || newCount > 20) return;
    setTeamCount(newCount);
    // Update teams list length
    setTeams((prev) => {
      const next = [...prev];
      if (newCount > next.length) {
        for (let i = next.length; i < newCount; i++) {
          next.push(`Team ${i + 1}`);
        }
      } else {
        next.splice(newCount);
      }
      return next;
    });
  };

  const updateRoster = (position: keyof RosterSettings, val: number) => {
    setRoster((prev) => {
      const next = { ...prev };
      const current = next[position];
      if (current + val < 0) return prev;
      next[position] = current + val;
      return next;
    });
  };

  const handleTeamNameChange = (idx: number, val: string) => {
    setTeams((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError("League name is required");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scoringType,
          teamCount,
          draftType,
          rosterSettings: roster,
          teams,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create league");
      }

      // If database is not configured, save league settings to localStorage so we can simulate the draft offline!
      if (data.offline) {
        const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
        const newLeague = {
          id: data.leagueId,
          name,
          platform: "manual",
          scoringType,
          teamCount,
          draftType,
          rosterSettings: roster,
          teams: teams.map((teamName, idx) => ({
            id: `mock-team-${idx + 1}`,
            name: teamName,
            ownerName: idx === 0 ? "My Owner" : `Owner ${idx + 1}`,
            draftPosition: idx + 1,
            isUserTeam: idx === 0,
          })),
          drafts: [
            {
              id: data.draftId,
              status: "setup",
              currentPickNumber: 1,
              totalRounds: Object.values(roster).reduce((a, b) => a + b, 0),
              draftType,
            },
          ],
          createdAt: new Date().toISOString(),
        };
        offlineLeagues.push(newLeague);
        localStorage.setItem("offline_leagues", JSON.stringify(offlineLeagues));
      }

      router.push(`/leagues/${data.leagueId}/import?draftId=${data.draftId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to save league. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalRosterSpots = Object.values(roster).reduce((a, b) => a + b, 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <span className="text-sm font-bold text-slate-400">Step 1 of 3: Setup League</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Setup New League</h1>
            <p className="text-slate-400 text-sm mt-1">Configure your league scoring, size, draft rules, and rosters.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-4 bg-red-950/40 border border-red-900/60 text-red-200 text-sm rounded-xl text-center">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column - Basic Settings */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-6">
                <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-emerald-400" />
                  League & Draft Settings
                </h3>

                <div className="space-y-2">
                  <label htmlFor="leagueName" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    League Name
                  </label>
                  <input
                    id="leagueName"
                    type="text"
                    required
                    placeholder="e.g. The Gridiron Masters"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-950/80 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 text-sm transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Team Count
                    </label>
                    <div className="flex items-center justify-between bg-slate-950/80 border border-slate-900 rounded-xl px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleTeamCountChange(teamCount - 1)}
                        className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-bold text-sm text-slate-200">{teamCount}</span>
                      <button
                        type="button"
                        onClick={() => handleTeamCountChange(teamCount + 1)}
                        className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Draft Style
                    </label>
                    <select
                      value={draftType}
                      onChange={(e) => setDraftType(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-slate-950/80 border border-slate-900 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 text-sm transition-all"
                    >
                      <option value="snake">Snake Draft</option>
                      <option value="linear">Linear Draft</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Scoring Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["standard", "half_ppr", "ppr"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setScoringType(type)}
                        className={`py-2 px-3 rounded-xl border text-center font-bold text-xs capitalize transition-all cursor-pointer ${
                          scoringType === type
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                            : "bg-slate-950/80 border-slate-900 text-slate-400 hover:border-slate-800"
                        }`}
                      >
                        {type.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Roster Settings */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-400" />
                    Roster Requirements
                  </h3>
                  <span className="text-xs bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 font-bold text-emerald-400">
                    {totalRosterSpots} Rounds
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(Object.keys(roster) as Array<keyof RosterSettings>).map((pos) => (
                    <div key={pos} className="flex items-center justify-between py-1 border-b border-slate-900/40 last:border-0">
                      <div>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">{pos}</p>
                        <p className="text-2xs text-slate-500">Starting roster slot size</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateRoster(pos, -1)}
                          className="p-1 hover:bg-slate-950 text-slate-500 hover:text-white rounded-lg border border-slate-900 transition-all cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm text-slate-200">{roster[pos]}</span>
                        <button
                          type="button"
                          onClick={() => updateRoster(pos, 1)}
                          className="p-1 hover:bg-slate-950 text-slate-500 hover:text-white rounded-lg border border-slate-900 transition-all cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Names List Setup */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-6">
              <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Team Draft Order Configurations
              </h3>
              <p className="text-xs text-slate-400">
                Setup team names according to the draft order slots. Slot 1 drafts first. Team 1 (Slot 1) is assumed to be your team by default, but you can configure position.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {teams.map((teamName, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xs font-extrabold text-slate-500 bg-slate-950 h-5 w-5 rounded-full flex items-center justify-center border border-slate-900">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      required
                      placeholder={`Team ${idx + 1}`}
                      value={teamName}
                      onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                      className={`block w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 text-xs transition-all ${
                        idx === 0 ? "border-emerald-500/40 shadow-sm shadow-emerald-500/5" : "border-slate-900"
                      }`}
                    />
                    {idx === 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded-md border border-emerald-900/40">
                        Me
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-sm transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center py-3.5 px-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  "Create League & Continue"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
