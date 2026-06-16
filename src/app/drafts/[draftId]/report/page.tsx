"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck, Zap, HeartPulse, Sparkles, CheckCircle2, ChevronRight, HelpCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { getDefaultOfflinePlayers } from "@/lib/integrations/default-players";

interface PageProps {
  params: Promise<{ draftId: string }>;
}

export default function PostDraftReportPage({ params }: PageProps) {
  const router = useRouter();

  // Unwrap the params promise using React.use()
  const { draftId } = use(params);

  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  
  const [leagueName, setLeagueName] = useState("My League");
  const [teamName, setTeamName] = useState("My Team");
  const [picks, setPicks] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [scoringType, setScoringType] = useState("ppr");

  const fetchDraftReport = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/drafts/${draftId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (data.offline) {
        setOffline(true);
        loadOfflineReport();
      } else {
        setOffline(false);
        setLeagueName(data.league.name);
        setPicks(data.picks);
        setTeams(data.teams);
        
        // Find user team name
        const userTeam = data.teams.find((t: any) => t.isUserTeam);
        setTeamName(userTeam?.name || "My Team");
        setScoringType(data.league.scoringType);
      }
    } catch (err) {
      console.warn("Backend error fetching report, falling back offline.");
      setOffline(true);
      loadOfflineReport();
    } finally {
      setLoading(false);
    }
  };

  const loadOfflineReport = () => {
    const offlineLeagues = JSON.parse(localStorage.getItem("offline_leagues") || "[]");
    const matchedLeague = offlineLeagues.find((l: any) => l.drafts.some((d: any) => d.id === draftId));

    if (!matchedLeague) {
      alert("Draft not found.");
      router.push("/dashboard");
      return;
    }

    const draft = matchedLeague.drafts.find((d: any) => d.id === draftId);
    setLeagueName(matchedLeague.name);
    setScoringType(matchedLeague.scoringType);
    setTeams(matchedLeague.teams);

    // Load default players to fill in detailed stats (ADP, projections, etc.)
    const leaguePlayers = matchedLeague.players && matchedLeague.players.length > 0
      ? matchedLeague.players
      : getDefaultOfflinePlayers();

    const enrichedPicks = (draft.picks || []).map((p: any) => {
      const matchedPlayer = leaguePlayers.find((lp: any) => lp.id === p.playerId || lp.name?.toLowerCase() === p.player?.name?.toLowerCase());
      
      return {
        ...p,
        player: p.player ? {
          ...p.player,
          adp: matchedPlayer?.rankings?.[0]?.adp || matchedPlayer?.adp || 150,
          projectedPoints: matchedPlayer?.rankings?.[0]?.projectedPoints || matchedPlayer?.projectedPoints || 100,
          riskScore: matchedPlayer?.rankings?.[0]?.riskScore || matchedPlayer?.riskScore || 5,
          overallRank: matchedPlayer?.rankings?.[0]?.overallRank || matchedPlayer?.overallRank || 150,
          tier: matchedPlayer?.rankings?.[0]?.tier || matchedPlayer?.tier || 10,
        } : null
      };
    });

    setPicks(enrichedPicks);

    const userTeam = matchedLeague.teams.find((t: any) => t.isUserTeam);
    setTeamName(userTeam?.name || "My Team");
  };

  useEffect(() => {
    fetchDraftReport();
  }, [draftId]);

  // Extract User Drafted Players
  const userPicks = useMemo(() => {
    const userTeam = teams.find((t) => t.isUserTeam);
    if (!userTeam) return [];
    return picks.filter((p) => p.teamId === userTeam.id);
  }, [picks, teams]);

  // Calculate Report Analytics
  const analytics = useMemo(() => {
    if (userPicks.length === 0) return null;

    // Extract players from picks
    const userPlayers = userPicks.map((up) => up.player || {
      name: "Selected Player",
      position: "RB",
      nflTeam: "FA",
      byeWeek: 0,
      overallRank: 100,
      adp: 100,
      projectedPoints: 120,
      riskScore: 5,
    });

    // 1. Steal of the draft (highest adp - pickNumber)
    let bestValuePick = userPicks[0];
    let maxDiff = -Infinity;

    userPicks.forEach((up) => {
      const p = up.player;
      if (p) {
        const diff = up.pickNumber - p.adp;
        if (diff > maxDiff) {
          maxDiff = diff;
          bestValuePick = up;
        }
      }
    });

    // 2. Riskiest pick (highest riskScore)
    let riskiestPick = userPicks[0];
    let maxRisk = -Infinity;

    userPicks.forEach((up) => {
      const p = up.player;
      if (p && p.riskScore > maxRisk) {
        maxRisk = p.riskScore;
        riskiestPick = up;
      }
    });

    // 3. Core Pillar (highest projected points starter)
    let corePillar = userPicks[0];
    let maxPoints = -Infinity;

    userPicks.forEach((up) => {
      const p = up.player;
      if (p && p.projectedPoints > maxPoints) {
        maxPoints = p.projectedPoints;
        corePillar = up;
      }
    });

    // 4. Positional Strength Grading
    const posCounts: Record<string, number> = {};
    const posPoints: Record<string, number> = {};
    userPlayers.forEach((p) => {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1;
      posPoints[p.position] = (posPoints[p.position] || 0) + p.projectedPoints;
    });

    // Determine strengths & weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    const rbCount = posCounts["RB"] || 0;
    const wrCount = posCounts["WR"] || 0;
    const qbCount = posCounts["QB"] || 0;
    const teCount = posCounts["TE"] || 0;

    if (rbCount >= 4) strengths.push("Running Back Depth (Solid flex optionality)");
    if (rbCount <= 2) weaknesses.push("Running Back Starters (Thin starting tier)");

    if (wrCount >= 5) strengths.push("Wide Receiver Core (Explosive yardage floor)");
    if (wrCount <= 2) weaknesses.push("Wide Receiver Depth (Susceptible to injury gaps)");

    if (qbCount >= 2 && posPoints["QB"] > 350) strengths.push("Quarterback Room (High floor scoring)");
    if (teCount === 1 && posPoints["TE"] < 150) weaknesses.push("Tight End Vulnerability (Stream required)");

    // Bye Week overlap starters check
    const byeOverlaps: Record<number, number> = {};
    userPlayers.forEach((p) => {
      if (p.position === "QB" || p.position === "RB" || p.position === "WR" || p.position === "TE") {
        byeOverlaps[p.byeWeek] = (byeOverlaps[p.byeWeek] || 0) + 1;
      }
    });

    const badByeWeeks = Object.entries(byeOverlaps)
      .filter(([_, count]) => count >= 3)
      .map(([bye]) => parseInt(bye));

    // Calculate final grade
    // Base grade on total projected points compared to averages
    const totalProj = userPlayers.reduce((sum, p) => sum + p.projectedPoints, 0);
    let grade = "B";
    let gradeColor = "text-blue-400 border-blue-900/60 bg-blue-950/20";
    let gradeDesc = "Solid Contender";

    if (totalProj >= 2200) {
      grade = "A+";
      gradeColor = "text-emerald-400 border-emerald-900/60 bg-emerald-950/20";
      gradeDesc = "Championship Favorite";
    } else if (totalProj >= 2000) {
      grade = "A-";
      gradeColor = "text-emerald-400 border-emerald-900/40 bg-emerald-950/10";
      gradeDesc = "Playoff Lock";
    } else if (totalProj >= 1800) {
      grade = "B+";
      gradeColor = "text-blue-400 border-blue-900/40 bg-blue-950/10";
      gradeDesc = "Strong Playoff Hopeful";
    } else if (totalProj < 1500) {
      grade = "C-";
      gradeColor = "text-red-400 border-red-900/40 bg-red-950/10";
      gradeDesc = "Needs Waiver Support";
    }

    return {
      bestValuePick,
      riskiestPick,
      corePillar,
      strengths,
      weaknesses,
      badByeWeeks,
      totalProj: Math.round(totalProj),
      grade,
      gradeColor,
      gradeDesc,
    };
  }, [userPicks, teams]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="mt-2 text-sm text-slate-400">Analyzing draft rosters...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen text-slate-200">
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{leagueName}</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Title */}
        <div className="text-center md:text-left space-y-1">
          <span className="inline-flex items-center gap-1 text-2xs font-extrabold uppercase text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
            Draft Analyzer Report Card
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Draft Report: {teamName}</h1>
        </div>

        {analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Left Column: Grade Card */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-8 text-center space-y-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none" />
              <div className="space-y-1 z-10">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Overall Draft Grade</p>
                <h2 className="text-2xl font-black text-white">{analytics.gradeDesc}</h2>
              </div>

              <div className={`h-32 w-32 rounded-full border-4 flex items-center justify-center text-5xl font-black shadow-inner z-10 ${analytics.gradeColor}`}>
                {analytics.grade}
              </div>

              <div className="space-y-2 border-t border-slate-900/60 pt-6 w-full text-xs font-medium z-10 text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Projected Season Points</span>
                  <span className="font-extrabold text-white">{analytics.totalProj} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Draft Selections</span>
                  <span className="font-extrabold text-white">{userPicks.length} players</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Draft Format</span>
                  <span className="font-extrabold text-white uppercase">{scoringType.replace("_", " ")}</span>
                </div>
              </div>
            </div>

            {/* Middle/Right Columns: Breakdown Details */}
            <div className="md:col-span-2 space-y-6">
              {/* Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Steal */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Zap className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Steal of the Draft</span>
                  </div>
                  <h4 className="font-bold text-white text-sm truncate">{analytics.bestValuePick?.player?.name || "Player"}</h4>
                  <p className="text-2xs text-slate-500 font-medium">
                    Drafted Pick {analytics.bestValuePick?.pickNumber} (ADP {analytics.bestValuePick?.player?.adp})
                  </p>
                </div>

                {/* Risk */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400">
                    <HeartPulse className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Riskiest Gamble</span>
                  </div>
                  <h4 className="font-bold text-white text-sm truncate">{analytics.riskiestPick?.player?.name || "Player"}</h4>
                  <p className="text-2xs text-slate-500 font-medium">
                    Risk score: {analytics.riskiestPick?.player?.riskScore}/10 (Pick {analytics.riskiestPick?.pickNumber})
                  </p>
                </div>

                {/* Pillar */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Core Pillar</span>
                  </div>
                  <h4 className="font-bold text-white text-sm truncate">{analytics.corePillar?.player?.name || "Player"}</h4>
                  <p className="text-2xs text-slate-500 font-medium">
                    Proj: {analytics.corePillar?.player?.projectedPoints} pts (Overall Rank {analytics.corePillar?.player?.overallRank})
                  </p>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">Roster Strengths</h3>
                  <div className="space-y-2">
                    {analytics.strengths.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No major standout position strengths detected.</p>
                    ) : (
                      analytics.strengths.map((str, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs text-emerald-300 font-semibold bg-emerald-950/10 border border-emerald-950/20 px-3 py-2 rounded-xl">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          {str}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">Roster Weaknesses</h3>
                  <div className="space-y-2">
                    {analytics.weaknesses.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No glaring positional gaps identified. Balanced draft!</p>
                    ) : (
                      analytics.weaknesses.map((weak, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs text-amber-300 font-semibold bg-amber-950/10 border border-amber-950/20 px-3 py-2 rounded-xl">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                          {weak}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bye Week Warning */}
                {analytics.badByeWeeks.length > 0 && (
                  <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-start gap-3 text-red-200">
                    <AlertTriangle className="h-5 w-5 mt-0.5 text-red-400 shrink-0" />
                    <div className="text-xs">
                      <h4 className="font-bold mb-0.5">Heavy Bye Week Overlaps</h4>
                      <p className="text-red-300/80 leading-relaxed">
                        You have 3 or more starters sharing a bye week in Week {analytics.badByeWeeks.join(", ")}. 
                        Be prepared to make waiver wire substitutions during those weeks.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Waiver Wire Strategy Suggestions
                </h3>
                <div className="text-xs text-slate-400 leading-relaxed space-y-2">
                  <p>
                    1. <strong>Monitor Handcuffs:</strong> If you drafted high-risk starting running backs, pay attention to backup running backs in free agency to mitigate risk.
                  </p>
                  <p>
                    2. <strong>Stream Tight Ends:</strong> Since your Tight End slot is projected to yield moderate production, stay active on the waiver wire to identify break-out targets.
                  </p>
                  <p>
                    3. <strong>Watch Bye Weeks:</strong> Plan roster swaps ahead of Week {analytics.badByeWeeks[0] || "9"} to maintain active starter positions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-900/20 border border-slate-800 rounded-3xl space-y-4">
            <Trophy className="h-12 w-12 text-slate-700 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-400">Roster data unavailable</p>
              <p className="text-xs text-slate-600">Ensure picks have been successfully entered in the draft room.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
