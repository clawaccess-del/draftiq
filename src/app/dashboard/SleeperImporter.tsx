"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function SleeperImporter({ defaultUsername = "" }: { defaultUsername?: string }) {
  const router = useRouter();

  const [username, setUsername] = useState(defaultUsername);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [leagues, setLeagues] = useState<any[]>([]);
  const [sleeperUser, setSleeperUser] = useState<any | null>(null);
  const [isLinked, setIsLinked] = useState(!!defaultUsername);

  // Trigger search on mount/login if a linked username exists
  useEffect(() => {
    if (defaultUsername) {
      performSearch(defaultUsername);
    }
  }, [defaultUsername]);

  const performSearch = async (uname: string) => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setLeagues([]);
    setSleeperUser(null);

    try {
      const res = await fetch("/api/integrations/sleeper/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to search Sleeper username");

      setSleeperUser(data.user);
      setLeagues(data.leagues || []);
    } catch (err: any) {
      setError(err?.message || "Something went wrong searching Sleeper.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username) {
      performSearch(username);
    }
  };

  const handleLinkProfile = async () => {
    if (!sleeperUser) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeperUsername: sleeperUser.username }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save username");

      setIsLinked(true);
      setSuccessMsg("Account linked to profile! Next time you login, leagues will auto-populate.");
    } catch (err: any) {
      setError(err?.message || "Failed to link profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkLeague = async (league: any) => {
    if (!sleeperUser) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/integrations/sleeper/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.leagueId,
          userSleeperId: sleeperUser.userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link Sleeper league");

      // Handle offline local storage save
      if (data.offline) {
        const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
        const details = data.leagueDetails;
        
        const newLeague = {
          id: data.leagueId,
          name: details.name,
          platform: "sleeper",
          scoringType: details.scoringType,
          teamCount: details.teamCount,
          draftType: details.draftType,
          rosterSettings: details.rosterSettings,
          teams: details.teams,
          drafts: [
            {
              id: data.draftId,
              status: "active",
              currentPickNumber: details.picks.length + 1,
              totalRounds: Object.values(details.rosterSettings).reduce((a: any, b: any) => a + b, 0),
              draftType: details.draftType,
              picks: details.picks.map((p: any) => ({
                pickNumber: p.pickNumber,
                roundNumber: p.roundNumber,
                teamId: details.teams.find((t: any) => t.id === p.teamId)?.id || p.teamId,
                playerId: p.playerId,
                player: {
                  id: p.playerId,
                  name: `${p.metadata?.first_name || ""} ${p.metadata?.last_name || "Sleeper Player"}`.trim(),
                  position: p.metadata?.position || "RB",
                  nflTeam: p.metadata?.team || "FA",
                  byeWeek: 0,
                },
              })),
            },
          ],
          players: [],
          createdAt: new Date().toISOString(),
        };

        offlineLeagues.push(newLeague);
        localStorage.setItem("offline_leagues", JSON.stringify(offlineLeagues));
      }

      router.push(`/drafts/${data.draftId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to sync Sleeper league.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-6 shadow-sm">
      <div>
        <h3 className="text-base font-bold text-slate-200">Sleeper Platform Sync</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Enter your Sleeper username to fetch your leagues and sync live draft picks automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </span>
          <input
            type="text"
            required
            placeholder="Enter Sleeper Username (e.g. tysanseo)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 text-xs transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-200 text-2xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-300 text-2xs rounded-xl flex items-center gap-2 font-bold animate-pulse">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          {successMsg}
        </div>
      )}

      {sleeperUser && (
        <div className="space-y-4 pt-2 border-t border-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-extrabold uppercase shadow-inner">
                {sleeperUser.displayName.slice(0, 2)}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{sleeperUser.displayName}</h4>
                <p className="text-[10px] text-slate-500">Sleeper ID: {sleeperUser.userId}</p>
              </div>
            </div>

            {/* Link Account Button */}
            {!isLinked ? (
              <button
                type="button"
                onClick={handleLinkProfile}
                disabled={saving}
                className="py-1 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-lg text-3xs font-extrabold transition-all uppercase tracking-wider cursor-pointer"
              >
                {saving ? "Linking..." : "Link Profile"}
              </button>
            ) : (
              <span className="flex items-center text-emerald-400 text-3xs font-extrabold uppercase tracking-wider gap-1.5 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-900/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                Linked
              </span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">NFL Leagues Found ({leagues.length})</p>
            
            {leagues.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No leagues found for this user in the current year.</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {leagues.map((league) => (
                  <div
                    key={league.leagueId}
                    className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-900 rounded-xl text-xs hover:border-slate-800 transition-all"
                  >
                    <div>
                      <h5 className="font-bold text-slate-200">{league.name}</h5>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">
                        {league.teamCount} Teams — Season {league.season}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLinkLeague(league)}
                      className="inline-flex items-center gap-1 py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer"
                    >
                      Sync League
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
