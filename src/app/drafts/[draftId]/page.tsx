"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Search,
  UserCheck,
  Star,
  Skull,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  User as UserIcon,
  Shield,
  HelpCircle,
  Menu,
  ChevronRight,
  X,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { generateRecommendations, calculateNextPick } from "@/lib/recommendations/recommendation-engine";

interface PageProps {
  params: Promise<{ draftId: string }>;
}

export default function DraftRoomPage({ params }: PageProps) {
  const router = useRouter();
  
  // Unwrap the params promise using React.use()
  const { draftId } = use(params);

  // States
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("ALL");
  const [sortBy, setSortBy] = useState("score"); // score, adp, points, tier
  const [activeMobileTab, setActiveMobileTab] = useState("players"); // board, players, recs, roster, teams

  // Watchlist & Avoids (saved in localStorage)
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [avoidList, setAvoidList] = useState<string[]>([]);

  // Draft Data State
  const [leagueName, setLeagueName] = useState("Draft Room");
  const [scoringType, setScoringType] = useState("ppr");
  const [teamCount, setTeamCount] = useState(12);
  const [draftType, setDraftType] = useState("snake");
  const [totalRounds, setTotalRounds] = useState(15);
  const [currentPick, setCurrentPick] = useState(1);
  const [draftStatus, setDraftStatus] = useState("setup");
  const [userPosition, setUserPosition] = useState(1);
  
  const [teams, setTeams] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  // Fetch Draft Data
  const fetchDraftData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/drafts/${draftId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load draft");

      if (data.offline) {
        setOffline(true);
        loadOfflineData();
      } else {
        setOffline(false);
        setLeagueName(data.league.name);
        setScoringType(data.league.scoringType);
        setTeamCount(data.league.teamCount);
        setDraftType(data.league.draftType);
        setTotalRounds(data.draft.totalRounds);
        setCurrentPick(data.draft.currentPickNumber);
        setDraftStatus(data.draft.status);
        
        const uPos = data.teams.find((t: any) => t.isUserTeam)?.draftPosition || 1;
        setUserPosition(uPos);
        setTeams(data.teams);
        setPicks(data.picks);
        setPlayers(data.availablePlayers);
      }
    } catch (err) {
      console.warn("Failed to connect to backend API, falling back to offline localStorage mode.");
      setOffline(true);
      loadOfflineData();
    } finally {
      setLoading(false);
    }
  };

  const loadOfflineData = () => {
    const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
    const matchedLeague = offlineLeagues.find((l: any) => l.drafts.some((d: any) => d.id === draftId));

    if (!matchedLeague) {
      alert("Draft not found. Please set up a league first.");
      router.push("/dashboard");
      return;
    }

    const draft = matchedLeague.drafts.find((d: any) => d.id === draftId);
    setLeagueName(matchedLeague.name);
    setScoringType(matchedLeague.scoringType);
    setTeamCount(matchedLeague.teamCount);
    setDraftType(matchedLeague.draftType);
    setTotalRounds(draft.totalRounds);
    setCurrentPick(draft.currentPickNumber);
    setDraftStatus(draft.status);
    
    const uPos = matchedLeague.teams.find((t: any) => t.isUserTeam)?.draftPosition || 1;
    setUserPosition(uPos);
    setTeams(matchedLeague.teams);
    setPicks(draft.picks || []);
    
    // Available players are players from rankings who are not in the picks list
    const draftedIds = new Set((draft.picks || []).map((p: any) => p.playerId));
    const allPlayersMapped = (matchedLeague.players || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      nflTeam: p.nflTeam,
      byeWeek: p.byeWeek,
      injuryStatus: p.injuryStatus,
      overallRank: p.rankings[0]?.overallRank || 99,
      positionRank: p.rankings[0]?.positionRank || 1,
      projectedPoints: p.rankings[0]?.projectedPoints || 0,
      adp: p.rankings[0]?.adp || 200,
      tier: p.rankings[0]?.tier || 10,
      riskScore: p.rankings[0]?.riskScore || 5,
      notes: p.rankings[0]?.notes || "",
    }));

    setPlayers(allPlayersMapped.filter((p: any) => !draftedIds.has(p.id)));
  };

  useEffect(() => {
    fetchDraftData();
    // Load watchlist & avoids
    setWatchlist(JSON.parse(localStorage.getItem(`watchlist_${draftId}`) || "[]"));
    setAvoidList(JSON.parse(localStorage.getItem(`avoid_${draftId}`) || "[]"));
  }, [draftId]);

  // Save watchlist / avoid list helper
  const updateWatchlist = (id: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem(`watchlist_${draftId}`, JSON.stringify(next));
      return next;
    });
  };

  const updateAvoidList = (id: string) => {
    setAvoidList((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem(`avoid_${draftId}`, JSON.stringify(next));
      return next;
    });
  };

  // Roster Ratios Helper
  const rosterSettings = useMemo(() => {
    // Attempt to parse roster settings from offline/online configs
    const defaultRoster = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1, BENCH: 6 };
    if (offline) {
      const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
      const matched = offlineLeagues.find((l: any) => l.drafts.some((d: any) => d.id === draftId));
      return matched?.rosterSettings || defaultRoster;
    }
    // online logic handles rosterSettingsJson
    return defaultRoster;
  }, [offline, draftId]);

  // Calculate Snake/Linear clock team draft slot
  const currentTeamOnClock = useMemo(() => {
    if (teams.length === 0) return null;
    const round = Math.ceil(currentPick / teamCount);
    const pickInRound = currentPick % teamCount === 0 ? teamCount : currentPick % teamCount;

    let targetPosition = 0;
    if (draftType === "snake") {
      const isRoundEven = round % 2 === 0;
      targetPosition = isRoundEven ? teamCount - pickInRound + 1 : pickInRound;
    } else {
      targetPosition = pickInRound;
    }

    return teams.find((t) => t.draftPosition === targetPosition) || null;
  }, [currentPick, teamCount, teams, draftType]);

  const picksUntilUser = useMemo(() => {
    const nextUser = calculateNextPick(currentPick, teamCount, userPosition, draftType as any, totalRounds);
    return Math.max(0, nextUser - currentPick);
  }, [currentPick, teamCount, userPosition, draftType, totalRounds]);

  // Rosters mapped for all teams
  const teamRosters = useMemo(() => {
    return teams.map((team) => {
      const teamPicks = picks.filter((p) => p.teamId === team.id);
      const teamPlayers = teamPicks
        .map((pick) => {
          // Find player in available or in backup offline datasets
          return players.find((p) => p.id === pick.playerId) || pick.player || {
            id: pick.playerId,
            name: "Unknown Player",
            position: "FA",
            nflTeam: "FA",
            byeWeek: 0,
            overallRank: 999,
          };
        });

      return {
        teamId: team.id,
        name: team.name,
        isUserTeam: team.isUserTeam,
        draftPosition: team.draftPosition,
        players: teamPlayers,
      };
    });
  }, [teams, picks, players]);

  // Available players with watchlist/avoid scores added
  const scoredPlayers = useMemo(() => {
    if (players.length === 0 || teams.length === 0) return [];

    // Map through players and calculate raw scores
    const items = generateRecommendations(
      rosterSettings,
      {
        currentPick,
        totalRounds,
        draftType: draftType as any,
        teamCount,
        userPosition,
        picks: picks.map((p) => ({
          pickNumber: p.pickNumber,
          roundNumber: p.roundNumber,
          teamId: p.teamId,
          playerId: p.playerId,
        })),
      },
      teamRosters,
      players
    );

    // Modify scores based on watchlist/avoid lists
    return items.map((item) => {
      let finalScore = item.totalScore;
      let notes = item.player.notes || "";

      if (watchlist.includes(item.player.id)) {
        finalScore += 15;
        if (!item.warningFlags.includes("Watchlist Target")) {
          item.warningFlags.push("Watchlist Target");
        }
      }
      if (avoidList.includes(item.player.id)) {
        finalScore = Math.max(0, finalScore - 90);
        if (!item.warningFlags.includes("Avoid")) {
          item.warningFlags.push("Avoid");
        }
      }

      return {
        ...item,
        totalScore: Math.round(finalScore * 10) / 10,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [players, teamRosters, currentPick, watchlist, avoidList, rosterSettings, teamCount, userPosition, draftType, totalRounds, picks]);

  // Filter & Search
  const filteredPlayers = useMemo(() => {
    let result = [...scoredPlayers];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.player.name.toLowerCase().includes(query) ||
          p.player.position.toLowerCase().includes(query) ||
          p.player.nflTeam.toLowerCase().includes(query)
      );
    }

    if (selectedPosition !== "ALL") {
      result = result.filter((p) => p.player.position.toUpperCase() === selectedPosition.toUpperCase());
    }

    if (sortBy === "adp") {
      return result.sort((a, b) => a.player.adp - b.player.adp);
    } else if (sortBy === "points") {
      return result.sort((a, b) => b.player.projectedPoints - a.player.projectedPoints);
    } else if (sortBy === "tier") {
      return result.sort((a, b) => a.player.tier - b.player.tier || b.totalScore - a.totalScore);
    }

    // Default sorting is recommendation score
    return result.sort((a, b) => b.totalScore - a.totalScore);
  }, [scoredPlayers, searchQuery, selectedPosition, sortBy]);

  // User Roster List
  const userRosterPlayers = useMemo(() => {
    const userTeamData = teamRosters.find((r) => r.isUserTeam);
    return userTeamData?.players || [];
  }, [teamRosters]);

  // Draft pick submission handler
  const handleDraftPick = async (player: any) => {
    if (!currentTeamOnClock) return;

    if (offline) {
      // Offline implementation: Update local variables and save to localStorage
      const roundNumber = Math.ceil(currentPick / teamCount);
      const isFinished = currentPick === teamCount * totalRounds;

      const newPick = {
        pickNumber: currentPick,
        roundNumber,
        teamId: currentTeamOnClock.id,
        playerId: player.id,
        player,
      };

      const nextPick = currentPick + 1;
      const newStatus = isFinished ? "completed" : "active";

      // Save offline draft state
      const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
      const matchedIdx = offlineLeagues.findIndex((l: any) => l.drafts.some((d: any) => d.id === draftId));

      if (matchedIdx !== -1) {
        const draftIdx = offlineLeagues[matchedIdx].drafts.findIndex((d: any) => d.id === draftId);
        if (draftIdx !== -1) {
          const draft = offlineLeagues[matchedIdx].drafts[draftIdx];
          if (!draft.picks) draft.picks = [];
          draft.picks.push(newPick);
          draft.currentPickNumber = nextPick;
          draft.status = newStatus;
          offlineLeagues[matchedIdx].drafts[draftIdx] = draft;
          localStorage.setItem("offline_leagues", JSON.stringify(offlineLeagues));
        }
      }

      setPicks((prev) => [...prev, newPick]);
      setCurrentPick(nextPick);
      setDraftStatus(newStatus);
      setPlayers((prev) => prev.filter((p) => p.id !== player.id));

      if (isFinished) {
        alert("Draft completed! Redirecting to report card...");
        router.push(`/drafts/${draftId}/report`);
      }
    } else {
      try {
        const res = await fetch(`/api/drafts/${draftId}/pick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: player.id,
            teamId: currentTeamOnClock.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Refresh data from DB
        fetchDraftData();

        if (data.isFinished) {
          router.push(`/drafts/${draftId}/report`);
        }
      } catch (err: any) {
        alert(err?.message || "Failed to submit pick");
      }
    }
  };

  // Undo latest pick handler
  const handleUndo = async () => {
    if (currentPick <= 1) return;

    if (offline) {
      const targetPick = currentPick - 1;

      const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
      const matchedIdx = offlineLeagues.findIndex((l: any) => l.drafts.some((d: any) => d.id === draftId));

      if (matchedIdx !== -1) {
        const draftIdx = offlineLeagues[matchedIdx].drafts.findIndex((d: any) => d.id === draftId);
        if (draftIdx !== -1) {
          const draft = offlineLeagues[matchedIdx].drafts[draftIdx];
          const lastPick = draft.picks?.pop();
          draft.currentPickNumber = targetPick;
          draft.status = targetPick === 1 ? "setup" : "active";
          offlineLeagues[matchedIdx].drafts[draftIdx] = draft;
          localStorage.setItem("offline_leagues", JSON.stringify(offlineLeagues));

          // Return player to available list
          if (lastPick && lastPick.player) {
            setPlayers((prev) => [...prev, lastPick.player]);
          }
        }
      }

      setPicks((prev) => prev.slice(0, -1));
      setCurrentPick(targetPick);
      setDraftStatus(targetPick === 1 ? "setup" : "active");
    } else {
      try {
        const res = await fetch(`/api/drafts/${draftId}/undo`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchDraftData();
      } catch (err: any) {
        alert(err?.message || "Failed to undo pick");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="mt-2 text-sm text-slate-400">Opening Draft Board...</span>
      </div>
    );
  }

  const userNextPickNumber = calculateNextPick(currentPick, teamCount, userPosition, draftType as any, totalRounds);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen text-slate-200">
      {/* Top Banner Bar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-all">
              <ArrowRight className="h-4 w-4 rotate-180" />
            </Link>
            <div>
              <span className="inline-flex items-center gap-1.5 text-2xs font-extrabold uppercase text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
                {offline ? "Offline Sandbox Mode" : "Online Database Sync"}
              </span>
              <h2 className="text-sm font-bold text-white leading-tight">{leagueName}</h2>
            </div>
          </div>

          {/* Live Clock Stats */}
          <div className="flex items-center gap-4 sm:gap-6 bg-slate-950/60 border border-slate-900 rounded-2xl px-4 py-1.5 shadow-inner">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Round</p>
              <p className="text-sm font-black text-slate-100">{Math.ceil(currentPick / teamCount)}</p>
            </div>
            <div className="h-6 w-px bg-slate-900" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Overall Pick</p>
              <p className="text-sm font-black text-slate-100">{currentPick}</p>
            </div>
            <div className="h-6 w-px bg-slate-900" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">On The Clock</p>
              <p className="text-sm font-black text-emerald-400 truncate max-w-[100px] sm:max-w-none">
                {currentTeamOnClock?.isUserTeam ? "YOUR PICK" : currentTeamOnClock?.name || "None"}
              </p>
            </div>
            <div className="h-6 w-px bg-slate-900" />
            <div className="text-center hidden md:block">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Your Next Pick</p>
              <p className="text-sm font-black text-slate-300">
                Pick {userNextPickNumber} {picksUntilUser > 0 ? `(${picksUntilUser} away)` : "(Now!)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={currentPick <= 1}
              className="inline-flex items-center justify-center p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Undo Pick"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Selectors */}
      <div className="md:hidden flex border-b border-slate-900 bg-slate-950/80 sticky top-16 z-30">
        {[
          { id: "board", label: "Board" },
          { id: "players", label: "Players" },
          { id: "recs", label: "Co-Pilot" },
          { id: "roster", label: "My Roster" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveMobileTab(tab.id)}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all ${
              activeMobileTab === tab.id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Responsive Main Layout */}
      <div className="max-w-[1600px] w-full mx-auto px-4 py-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Draft Board */}
        <div className={`md:col-span-3 bg-slate-900/20 border border-slate-900 rounded-3xl p-5 space-y-4 md:block h-[calc(100vh-190px)] overflow-y-auto ${
          activeMobileTab === "board" ? "block" : "hidden"
        }`}>
          <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-4 w-4 text-emerald-500" />
            Draft Board
          </h3>

          <div className="space-y-3">
            {Array.from({ length: totalRounds }).map((_, rIdx) => {
              const round = rIdx + 1;
              const roundPicks = Array.from({ length: teamCount }).map((_, pIdx) => {
                const pickNum = (round - 1) * teamCount + pIdx + 1;
                // Determine team drafting at this position
                const isRoundEven = round % 2 === 0;
                let draftSlot = 0;
                if (draftType === "snake") {
                  draftSlot = isRoundEven ? teamCount - pIdx : pIdx + 1;
                } else {
                  draftSlot = pIdx + 1;
                }
                const team = teams.find((t) => t.draftPosition === draftSlot);
                const pickDetails = picks.find((p) => p.pickNumber === pickNum);

                return { pickNum, team, pickDetails };
              });

              return (
                <div key={round} className="bg-slate-950/60 border border-slate-900/80 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-900/60 pb-1.5">
                    <span className="text-xs font-bold text-slate-400">Round {round}</span>
                    <span className="text-[10px] text-slate-600 font-medium">Snake</span>
                  </div>

                  <div className="space-y-1.5">
                    {roundPicks.map((item) => {
                      const isCurrent = item.pickNum === currentPick;
                      return (
                        <div
                          key={item.pickNum}
                          className={`flex items-center justify-between p-2 rounded-xl text-2xs transition-all ${
                            isCurrent
                              ? "bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 font-bold"
                              : item.pickDetails
                              ? "bg-slate-900/20 text-slate-500"
                              : "bg-slate-900/40 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-extrabold text-[10px] text-slate-600 w-5">
                              {round}.{item.pickNum % teamCount === 0 ? teamCount : item.pickNum % teamCount}
                            </span>
                            <span className={`truncate max-w-[80px] ${item.team?.isUserTeam ? "text-emerald-400 font-bold" : ""}`}>
                              {item.team?.name}
                            </span>
                          </div>

                          <div className="truncate text-right">
                            {item.pickDetails ? (
                              <span className="font-semibold text-slate-200">
                                {item.pickDetails.player?.name || "Player Selected"} 
                                <span className="text-[9px] text-emerald-400 ml-1">{item.pickDetails.player?.position}</span>
                              </span>
                            ) : isCurrent ? (
                              <span className="text-emerald-400 animate-pulse font-bold uppercase tracking-wider text-[9px]">ON CLOCK</span>
                            ) : (
                              <span className="text-slate-700">Empty</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Available Players */}
        <div className={`md:col-span-5 space-y-6 h-[calc(100vh-190px)] overflow-y-auto ${
          activeMobileTab === "players" ? "block" : "hidden md:block"
        }`}>
          {/* Filters & Search Header */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Search players by name, team, or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 text-sm transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Position Tabs */}
              <div className="flex flex-wrap gap-1">
                {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`py-1.5 px-3 rounded-lg border font-bold text-2xs transition-all cursor-pointer ${
                      selectedPosition === pos
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              {/* Sorting */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg text-slate-400 focus:outline-none text-2xs font-bold"
              >
                <option value="score">Sort: Recommendation</option>
                <option value="adp">Sort: ADP Value</option>
                <option value="points">Sort: Projected Pts</option>
                <option value="tier">Sort: Player Tier</option>
              </select>
            </div>
          </div>

          {/* Players Table */}
          <div className="bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 text-center">Score</th>
                    <th className="py-3.5 px-2">Player</th>
                    <th className="py-3.5 px-2">Pos</th>
                    <th className="py-3.5 px-2">Bye</th>
                    <th className="py-3.5 px-2 text-right">Proj Pts</th>
                    <th className="py-3.5 px-2 text-right">ADP</th>
                    <th className="py-3.5 px-2 text-center">Tier</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-300 font-medium">
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold">
                        No available players match your filter settings.
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((item) => {
                      const isWatched = watchlist.includes(item.player.id);
                      const isAvoided = avoidList.includes(item.player.id);

                      return (
                        <tr key={item.player.id} className={`hover:bg-slate-900/10 group ${
                          isAvoided ? "opacity-45" : ""
                        }`}>
                          <td className="py-3.5 px-4 text-center font-black">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                              item.totalScore >= 80 
                                ? "bg-emerald-950/40 border border-emerald-900/40 text-emerald-400"
                                : item.totalScore >= 50
                                ? "bg-blue-950/20 border border-blue-900/20 text-blue-400"
                                : "bg-slate-900 border border-slate-800 text-slate-500"
                            }`}>
                              {item.totalScore}
                            </span>
                          </td>
                          <td className="py-3.5 px-2">
                            <div>
                              <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                {item.player.name}
                              </p>
                              <span className="text-2xs text-slate-500 font-bold uppercase">
                                {item.player.nflTeam} — {item.player.injuryStatus || "Healthy"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                              item.player.position === "QB" ? "bg-purple-950/30 text-purple-400 border border-purple-900/30" :
                              item.player.position === "RB" ? "bg-cyan-950/30 text-cyan-400 border border-cyan-900/30" :
                              item.player.position === "WR" ? "bg-amber-950/30 text-amber-400 border border-amber-900/30" :
                              "bg-slate-950 text-slate-400 border border-slate-800"
                            }`}>
                              {item.player.position}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-slate-400 font-bold">{item.player.byeWeek}</td>
                          <td className="py-3.5 px-2 text-right font-semibold">{item.player.projectedPoints}</td>
                          <td className="py-3.5 px-2 text-right text-slate-400">{item.player.adp}</td>
                          <td className="py-3.5 px-2 text-center font-extrabold text-white text-sm">{item.player.tier}</td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              {/* Star (Watchlist) */}
                              <button
                                onClick={() => updateWatchlist(item.player.id)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  isWatched
                                    ? "bg-amber-950/30 border-amber-500/40 text-amber-400"
                                    : "bg-slate-950 border-slate-900 text-slate-600 hover:text-slate-400"
                                }`}
                              >
                                <Star className={`h-3.5 w-3.5 ${isWatched ? "fill-current" : ""}`} />
                              </button>

                              {/* Skull (Avoid) */}
                              <button
                                onClick={() => updateAvoidList(item.player.id)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  isAvoided
                                    ? "bg-red-950/30 border-red-500/40 text-red-400"
                                    : "bg-slate-950 border-slate-900 text-slate-600 hover:text-red-500/60"
                                }`}
                              >
                                <Skull className="h-3.5 w-3.5" />
                              </button>

                              {/* Draft button */}
                              <button
                                onClick={() => handleDraftPick(item.player)}
                                className="inline-flex items-center justify-center py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                              >
                                DRAFT
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: recommendations and roster needs */}
        <div className={`md:col-span-4 space-y-6 h-[calc(100vh-190px)] overflow-y-auto ${
          activeMobileTab === "recs" ? "block" : "hidden md:block"
        }`}>
          {/* Top Recommendation Panel */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none" />
            <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 relative z-10">
              <Sparkles className="h-4 w-4 text-emerald-400 fill-current" />
              Co-Pilot Recommendation
            </h3>

            {scoredPlayers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No recommendations available. Please import player data.</p>
            ) : (
              <div className="space-y-4 relative z-10">
                {/* Pick Card */}
                {scoredPlayers.slice(0, 3).map((rec, rIdx) => (
                  <div
                    key={rec.player.id}
                    className={`p-4 border rounded-2xl space-y-3 shadow-inner ${
                      rIdx === 0
                        ? "bg-slate-950/80 border-emerald-500/40 shadow-emerald-500/5"
                        : "bg-slate-950/40 border-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-emerald-400">#{rIdx + 1}</span>
                        <div>
                          <h4 className="font-extrabold text-white text-sm">{rec.player.name}</h4>
                          <p className="text-2xs text-slate-500 font-bold uppercase">
                            {rec.player.nflTeam} — {rec.player.position}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Score</span>
                        <span className="font-black text-white text-sm">{rec.totalScore}</span>
                      </div>
                    </div>

                    {/* Explanations */}
                    <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-900/60 pt-2.5">
                      {rec.explanation}
                    </p>

                    {/* Badges / Probability */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/60 pt-2.5">
                      <div className="flex flex-wrap gap-1">
                        {rec.warningFlags.map((flag) => (
                          <span
                            key={flag}
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              flag === "Tier Cliff" || flag === "Might Not Make It Back"
                                ? "bg-red-950/40 text-red-400 border border-red-900/40"
                                : flag === "Watchlist Target" || flag === "Best Value"
                                ? "bg-amber-950/40 text-amber-400 border border-amber-900/40"
                                : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                            }`}
                          >
                            {flag}
                          </span>
                        ))}
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Survival Chance</span>
                        <span className={`text-2xs font-extrabold ${
                          rec.survivalProbability <= 25 ? "text-red-400" :
                          rec.survivalProbability <= 50 ? "text-amber-400" :
                          "text-emerald-400"
                        }`}>
                          {rec.survivalProbability}% ({rec.survivalLabel})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Roster Panel */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-emerald-400" />
              My Roster
            </h3>

            <div className="space-y-2">
              {/* Starters mapping */}
              {(["QB", "RB", "WR", "TE", "FLEX", "SUPERFLEX", "K", "DST"] as string[]).map((pos) => {
                const limit = rosterSettings[pos as keyof typeof rosterSettings] || 0;
                if (limit === 0) return null;

                // Find drafted players assigned to this roster position
                // Wait! Since the client needs to map players into starter slots, let's filter:
                const assigned = userRosterPlayers.filter((p) => p.position === pos).slice(0, limit);
                const emptiesCount = Math.max(0, limit - assigned.length);

                return (
                  <div key={pos} className="space-y-1.5">
                    {assigned.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-900/80 rounded-xl text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xs font-extrabold uppercase text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {pos}
                          </span>
                          <span className="font-bold text-white">{p.name}</span>
                        </div>
                        <span className="text-2xs text-slate-500 font-bold uppercase">{p.nflTeam} — Bye {p.byeWeek}</span>
                      </div>
                    ))}
                    {Array.from({ length: emptiesCount }).map((_, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 border border-dashed border-slate-900 bg-slate-900/10 rounded-xl text-xs text-slate-600">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xs font-bold uppercase text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                            {pos}
                          </span>
                          <span className="italic">Empty Slot</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-800">Open</span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Bench */}
              <div className="pt-2 border-t border-slate-900/60 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bench</p>
                {userRosterPlayers.slice(
                  rosterSettings.QB + rosterSettings.RB + rosterSettings.WR + rosterSettings.TE + rosterSettings.FLEX + rosterSettings.SUPERFLEX + rosterSettings.K + rosterSettings.DST
                ).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900/40 rounded-xl text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="text-3xs font-extrabold uppercase text-slate-600 border border-slate-850 px-1 py-0.5 rounded">
                        {p.position}
                      </span>
                      <span>{p.name}</span>
                    </div>
                    <span className="text-[10px] uppercase">{p.nflTeam} — Bye {p.byeWeek}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
