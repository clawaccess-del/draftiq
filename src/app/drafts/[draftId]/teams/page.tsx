"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowLeft, Users, ChevronRight, HelpCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { getDefaultOfflinePlayers } from "@/lib/integrations/default-players";

interface PageProps {
  params: Promise<{ draftId: string }>;
}

export default function TeamRostersPage({ params }: PageProps) {
  const router = useRouter();

  // Unwrap the params promise using React.use()
  const { draftId } = use(params);

  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  
  const [leagueName, setLeagueName] = useState("My League");
  const [teamCount, setTeamCount] = useState(12);
  const [draftType, setDraftType] = useState("snake");
  const [currentPick, setCurrentPick] = useState(1);
  const [totalRounds, setTotalRounds] = useState(15);
  
  const [teams, setTeams] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  const fetchRostersData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/drafts/${draftId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (data.offline) {
        setOffline(true);
        loadOfflineRosters();
      } else {
        setOffline(false);
        setLeagueName(data.league.name);
        setTeamCount(data.league.teamCount);
        setDraftType(data.league.draftType);
        setCurrentPick(data.draft.currentPickNumber);
        setTotalRounds(data.draft.totalRounds);
        setTeams(data.teams);
        setPicks(data.picks);
        setPlayers(data.availablePlayers);
      }
    } catch (err) {
      console.warn("Backend error fetching rosters, loading offline mode.");
      setOffline(true);
      loadOfflineRosters();
    } finally {
      setLoading(false);
    }
  };

  const loadOfflineRosters = () => {
    const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
    const matchedLeague = offlineLeagues.find((l: any) => l.drafts.some((d: any) => d.id === draftId));

    if (!matchedLeague) {
      alert("Draft not found.");
      router.push("/dashboard");
      return;
    }

    const draft = matchedLeague.drafts.find((d: any) => d.id === draftId);
    setLeagueName(matchedLeague.name);
    setTeamCount(matchedLeague.teamCount);
    setDraftType(matchedLeague.draftType);
    setCurrentPick(draft.currentPickNumber);
    setTotalRounds(draft.totalRounds);
    setTeams(matchedLeague.teams);
    setPicks(draft.picks || []);
    
    const draftedIds = new Set((draft.picks || []).map((p: any) => p.playerId));
    const leaguePlayers = matchedLeague.players && matchedLeague.players.length > 0
      ? matchedLeague.players
      : getDefaultOfflinePlayers();

    const allPlayersMapped = leaguePlayers.map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      nflTeam: p.nflTeam,
      byeWeek: p.byeWeek,
      overallRank: p.rankings?.[0]?.overallRank || p.overallRank || 99,
      projectedPoints: p.rankings?.[0]?.projectedPoints || p.projectedPoints || 0,
      adp: p.rankings?.[0]?.adp || p.adp || 200,
      tier: p.rankings?.[0]?.tier || p.tier || 10,
    }));
    setPlayers(allPlayersMapped.filter((p: any) => !draftedIds.has(p.id)));
  };

  useEffect(() => {
    fetchRostersData();
  }, [draftId]);

  // Complete Roster Maps
  const detailedRosters = useMemo(() => {
    return teams.map((team) => {
      const teamPicks = picks.filter((p) => p.teamId === team.id);
      const teamPlayers = teamPicks
        .map((pick) => {
          return players.find((p) => p.id === pick.playerId) || pick.player || {
            name: "Unknown Player",
            position: "FA",
            nflTeam: "FA",
            byeWeek: 0,
            overallRank: 999,
            projectedPoints: 0,
          };
        });

      // Position Counts
      const qbCount = teamPlayers.filter((p) => p.position === "QB").length;
      const rbCount = teamPlayers.filter((p) => p.position === "RB").length;
      const wrCount = teamPlayers.filter((p) => p.position === "WR").length;
      const teCount = teamPlayers.filter((p) => p.position === "TE").length;

      // Simple weak positions check (based on standard roster requirements of 1 QB, 2 RB, 2 WR, 1 TE)
      const weaknesses: string[] = [];
      if (qbCount === 0) weaknesses.push("QB Starter");
      if (rbCount < 2) weaknesses.push("RB Starters");
      if (wrCount < 2) weaknesses.push("WR Starters");
      if (teCount === 0) weaknesses.push("TE Starter");

      // Likely next targets
      let targetPos = "RB / WR Depth";
      if (qbCount === 0) targetPos = "Starting QB";
      else if (teCount === 0) targetPos = "Starting TE";
      else if (rbCount < 2) targetPos = "Starting RB";
      else if (wrCount < 2) targetPos = "Starting WR";

      return {
        ...team,
        players: teamPlayers,
        counts: { QB: qbCount, RB: rbCount, WR: wrCount, TE: teCount },
        weaknesses,
        targetPos,
      };
    });
  }, [teams, picks, players]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="mt-2 text-sm text-slate-400">Loading team rosters...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen text-slate-200">
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/drafts/${draftId}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Draft Room
            </Link>
          </div>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{leagueName}</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 text-emerald-400" />
            League Rosters & Needs
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor other managers' rosters, position quotas, and predict their upcoming draft targets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {detailedRosters.map((team) => (
            <div key={team.id} className={`bg-slate-900/40 border rounded-3xl p-6 space-y-4 hover:shadow-lg transition-all ${
              team.isUserTeam ? "border-emerald-500/40 bg-slate-900/60 shadow-emerald-500/5" : "border-slate-900"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    {team.name}
                    {team.isUserTeam && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/40">
                        My Team
                      </span>
                    )}
                  </h3>
                  <p className="text-2xs text-slate-500 font-medium">Owner: {team.ownerName || `Owner ${team.draftPosition}`}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Draft Position</span>
                  <span className="font-extrabold text-white text-xs">Slot {team.draftPosition}</span>
                </div>
              </div>

              {/* Position counts */}
              <div className="grid grid-cols-4 gap-2 text-center py-2.5 bg-slate-950/40 rounded-xl border border-slate-900/60 text-2xs font-semibold">
                <div>
                  <span className="text-slate-500 block uppercase mb-0.5">QB</span>
                  <span className="text-slate-200 font-bold">{team.counts.QB}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase mb-0.5">RB</span>
                  <span className="text-slate-200 font-bold">{team.counts.RB}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase mb-0.5">WR</span>
                  <span className="text-slate-200 font-bold">{team.counts.WR}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase mb-0.5">TE</span>
                  <span className="text-slate-200 font-bold">{team.counts.TE}</span>
                </div>
              </div>

              {/* Roster Items */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Drafted Players ({team.players.length})</p>
                {team.players.length === 0 ? (
                  <p className="text-2xs text-slate-650 italic">No players drafted yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {team.players.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-950/60 border border-slate-900/80 rounded-lg text-2xs">
                        <span className="font-bold text-white truncate max-w-[100px]">{p.name}</span>
                        <span className="text-emerald-400 font-extrabold">{p.position}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Needs & Targets */}
              <div className="border-t border-slate-900/60 pt-4 flex flex-wrap items-center justify-between gap-4 text-2xs">
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block">Needs</span>
                  <span className="text-amber-400 font-semibold">
                    {team.weaknesses.length === 0 ? "Depth only" : team.weaknesses.join(", ")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 font-bold uppercase tracking-wider block">Predicted Target</span>
                  <span className="text-emerald-400 font-extrabold">{team.targetPos}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
