export interface RosterSettings {
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

export interface Player {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  byeWeek: number;
  injuryStatus?: string | null;
  overallRank: number;
  positionRank: number;
  projectedPoints: number;
  adp: number;
  tier: number;
  riskScore: number;
  ceilingProjection?: number | null;
  floorProjection?: number | null;
  notes?: string | null;
}

export interface DraftState {
  currentPick: number;
  totalRounds: number;
  draftType: "snake" | "linear";
  teamCount: number;
  userPosition: number; // 1-indexed draft slot for the user
  picks: {
    pickNumber: number;
    roundNumber: number;
    teamId: string;
    playerId: string;
  }[];
}

export interface TeamRoster {
  teamId: string;
  name: string;
  isUserTeam: boolean;
  draftPosition: number;
  players: Player[];
}

export interface RecommendationResult {
  player: Player;
  totalScore: number;
  scores: {
    projectedValue: number;
    vorp: number;
    positionalNeed: number;
    tierScarcity: number;
    opponentPressure: number;
    adpValue: number;
    byeWeekFit: number;
    riskAdjustment: number;
  };
  survivalProbability: number;
  survivalLabel: string;
  explanation: string;
  warningFlags: string[];
}

// Deterministic draft assistant recommendation engine
export function generateRecommendations(
  rosterSettings: RosterSettings,
  draftState: DraftState,
  teams: TeamRoster[],
  availablePlayers: Player[]
): RecommendationResult[] {
  if (availablePlayers.length === 0) return [];

  const userTeam = teams.find((t) => t.isUserTeam);
  if (!userTeam) return [];

  // 1. Calculate next user pick number
  const currentPick = draftState.currentPick;
  const userNextPick = calculateNextPick(currentPick, draftState.teamCount, draftState.userPosition, draftState.draftType, draftState.totalRounds);

  // 2. Pre-calculate replacement levels for VORP
  const replacementBaselines = calculateReplacementLevels(draftState.teamCount, rosterSettings, availablePlayers);

  // 3. Pre-calculate opponent positional needs
  const opponentNeeds = calculateOpponentPositionalNeeds(currentPick, userNextPick, draftState.teamCount, draftState.draftType, teams, rosterSettings);

  const results: RecommendationResult[] = availablePlayers.map((player) => {
    // A. Projected Value Score (0-100)
    // Compare player to max projected points overall in the available pool
    const maxPoints = Math.max(...availablePlayers.map((p) => p.projectedPoints), 1);
    const projectedValueScore = Math.min(100, Math.max(0, (player.projectedPoints / maxPoints) * 100));

    // B. Value Over Replacement Score (0-100)
    const baselinePoints = replacementBaselines[player.position] || 0;
    const vorpRaw = player.projectedPoints - baselinePoints;
    // Normalize VORP: assume max VORP is 150 points, min is -50 points
    const vorpScore = Math.min(100, Math.max(0, ((vorpRaw + 50) / 200) * 100));

    // C. Positional Need Score (0-100)
    const positionalNeedScore = calculatePositionalNeed(player.position, userTeam.players, rosterSettings);

    // D. Tier Scarcity Score (0-100)
    // Find all players of the same position in this tier
    const sameTierSamePos = availablePlayers.filter((p) => p.position === player.position && p.tier === player.tier);
    const totalInTierSamePos = sameTierSamePos.length;
    // If it is the last player in a high tier, give it a big boost
    let tierScarcityScore = 0;
    if (player.tier <= 4) {
      if (totalInTierSamePos === 1) tierScarcityScore = 100;
      else if (totalInTierSamePos === 2) tierScarcityScore = 75;
      else if (totalInTierSamePos === 3) tierScarcityScore = 50;
      else tierScarcityScore = 20;
    } else {
      tierScarcityScore = Math.max(0, 50 - totalInTierSamePos * 10);
    }

    // E. Opponent Pressure Score (0-100)
    // Measures how many teams picking before user's next pick need this position
    const opposingTeamsCount = opponentNeeds.teamsPickingBeforeNext;
    const teamsNeedingPos = opponentNeeds.needsCount[player.position] || 0;
    const opponentPressureScore = opposingTeamsCount > 0 
      ? Math.min(100, (teamsNeedingPos / opposingTeamsCount) * 100)
      : 0;

    // F. ADP Value Score (0-100)
    // Positive score if player has slid past their ADP
    const adpDiff = currentPick - player.adp;
    // Normalize: adpDiff > 24 picks = 100, adpDiff < -12 picks = 0
    const adpValueScore = Math.min(100, Math.max(0, ((adpDiff + 12) / 36) * 100));

    // G. Bye Week Fit Score (0-100)
    // Small penalty if same position starters share bye week
    const sharingByeCount = userTeam.players.filter(
      (p) => p.position === player.position && p.byeWeek === player.byeWeek
    ).length;
    const byeWeekFitScore = Math.max(0, 100 - sharingByeCount * 35);

    // H. Risk Adjustment Score (0-100)
    // Normalize: riskScore 1 = 100, riskScore 10 = 0
    const riskAdjustmentScore = Math.min(100, Math.max(0, ((10 - player.riskScore) / 9) * 100));

    // Total weighted score
    const totalScore =
      projectedValueScore * 0.30 +
      vorpScore * 0.25 +
      positionalNeedScore * 0.20 +
      tierScarcityScore * 0.10 +
      opponentPressureScore * 0.08 +
      adpValueScore * 0.04 +
      byeWeekFitScore * 0.02 +
      riskAdjustmentScore * 0.01;

    // Survival Probability
    // survival_probability = 100 - opponent_need_pressure - tier_scarcity_pressure - adp_pressure
    // opponent_need_pressure = (teamsNeedingPos / opposingTeamsCount) * 45
    // tier_scarcity_pressure = (4 - totalInTierSamePos) * 12 (if in tier <= 3)
    // adp_pressure = max(0, (userNextPick - player.adp) * 2)
    const opponentNeedPressure = opposingTeamsCount > 0 ? (teamsNeedingPos / opposingTeamsCount) * 40 : 0;
    const tierScarcityPressure = player.tier <= 3 ? Math.max(0, (4 - totalInTierSamePos) * 10) : 0;
    const adpPressure = Math.min(50, Math.max(0, (userNextPick - player.adp) * 1.5));
    
    let survivalProbability = Math.round(100 - opponentNeedPressure - tierScarcityPressure - adpPressure);
    survivalProbability = Math.min(95, Math.max(5, survivalProbability));

    let survivalLabel = "Could make it back";
    if (survivalProbability <= 25) survivalLabel = "Very unlikely to make it back";
    else if (survivalProbability <= 50) survivalLabel = "Risky to wait";
    else if (survivalProbability <= 75) survivalLabel = "Could make it back";
    else survivalLabel = "Likely to make it back";

    // Warning flags & badges
    const warningFlags: string[] = [];
    if (totalInTierSamePos === 1 && player.tier <= 4) warningFlags.push("Tier Cliff");
    if (player.riskScore >= 7) warningFlags.push("Injury Risk");
    if (sharingByeCount >= 2) warningFlags.push("Bye Week Risk");
    if (adpDiff >= 12) warningFlags.push("Best Value");
    if (positionalNeedScore >= 80) warningFlags.push("Fills Need");
    if (survivalProbability <= 25) warningFlags.push("Might Not Make It Back");

    // Explanation generation
    const explanation = generateExplanationText(player, {
      position: player.position,
      teamNeed: positionalNeedScore >= 80 ? "High" : positionalNeedScore >= 50 ? "Medium" : "Low",
      tierStatus: totalInTierSamePos === 1 ? `Last ${player.position} in Tier ${player.tier}` : `${totalInTierSamePos} remaining in Tier ${player.tier}`,
      opponentPressure: opposingTeamsCount > 0 ? `${teamsNeedingPos} of the next ${opposingTeamsCount} teams before your pick need ${player.position}` : "No teams picking before your next pick",
      survivalProbability,
      adpValue: adpDiff >= 6 ? `+${Math.round(adpDiff)} picks value` : adpDiff <= -6 ? `${Math.round(Math.abs(adpDiff))} picks reach` : "at ADP value",
    });

    return {
      player,
      totalScore: Math.round(totalScore * 10) / 10,
      scores: {
        projectedValue: Math.round(projectedValueScore),
        vorp: Math.round(vorpScore),
        positionalNeed: Math.round(positionalNeedScore),
        tierScarcity: Math.round(tierScarcityScore),
        opponentPressure: Math.round(opponentPressureScore),
        adpValue: Math.round(adpValueScore),
        byeWeekFit: Math.round(byeWeekFitScore),
        riskAdjustment: Math.round(riskAdjustmentScore),
      },
      survivalProbability,
      survivalLabel,
      explanation,
      warningFlags,
    };
  });

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

// Calculate the pick number of the user's next pick
export function calculateNextPick(
  currentPick: number,
  teamCount: number,
  userPosition: number,
  draftType: "snake" | "linear",
  totalRounds: number
): number {
  const currentRound = Math.ceil(currentPick / teamCount);

  // If draft is finished, return currentPick
  if (currentRound > totalRounds) return currentPick;

  let nextPick = currentPick + 1;
  while (nextPick <= teamCount * totalRounds) {
    const round = Math.ceil(nextPick / teamCount);
    const pickInRound = nextPick % teamCount === 0 ? teamCount : nextPick % teamCount;

    let pickTeamPosition = 0;
    if (draftType === "snake") {
      const isRoundEven = round % 2 === 0;
      pickTeamPosition = isRoundEven ? teamCount - pickInRound + 1 : pickInRound;
    } else {
      pickTeamPosition = pickInRound;
    }

    if (pickTeamPosition === userPosition && nextPick > currentPick) {
      return nextPick;
    }
    nextPick++;
  }

  return currentPick + teamCount; // Fallback
}

// Calculate VORP replacement levels for all positions
function calculateReplacementLevels(
  teamCount: number,
  roster: RosterSettings,
  available: Player[]
): Record<string, number> {
  const baselines: Record<string, number> = {};
  const positions = ["QB", "RB", "WR", "TE", "K", "DST"];

  positions.forEach((pos) => {
    // Estimate total starters at position across league + slice of bench
    const startingSpots = (roster[pos as keyof RosterSettings] || 0) + (pos === "RB" || pos === "WR" ? (roster.FLEX || 0) * 0.4 : 0);
    const leagueWideNeed = Math.round(teamCount * startingSpots * 1.3);

    // Get all players at this position, sorted by projected points desc
    const sortedPosPlayers = available
      .filter((p) => p.position.toUpperCase() === pos.toUpperCase())
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    // Set replacement level as player at index leagueWideNeed
    const replacementIdx = Math.min(sortedPosPlayers.length - 1, leagueWideNeed);
    baselines[pos] = replacementIdx >= 0 ? sortedPosPlayers[replacementIdx].projectedPoints : 0;
  });

  // Flex, Superflex, Bench defaults
  baselines["FLEX"] = Math.min(baselines["RB"] || 0, baselines["WR"] || 0);
  baselines["SUPERFLEX"] = baselines["QB"] || 0;

  return baselines;
}

// Calculate how many teams picking before user's next pick have high needs at positions
function calculateOpponentPositionalNeeds(
  currentPick: number,
  userNextPick: number,
  teamCount: number,
  draftType: "snake" | "linear",
  teams: TeamRoster[],
  roster: RosterSettings
): { teamsPickingBeforeNext: number; needsCount: Record<string, number> } {
  const needsCount: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  let teamsPickingBeforeNext = 0;

  for (let pick = currentPick; pick < userNextPick; pick++) {
    const round = Math.ceil(pick / teamCount);
    const pickInRound = pick % teamCount === 0 ? teamCount : pick % teamCount;

    let teamPos = 0;
    if (draftType === "snake") {
      const isRoundEven = round % 2 === 0;
      teamPos = isRoundEven ? teamCount - pickInRound + 1 : pickInRound;
    } else {
      teamPos = pickInRound;
    }

    const team = teams.find((t) => t.draftPosition === teamPos);
    if (team && !team.isUserTeam) {
      teamsPickingBeforeNext++;
      // Determine what positions this team needs
      const teamPlayers = team.players;
      const positions = ["QB", "RB", "WR", "TE"];
      positions.forEach((pos) => {
        const currentCount = teamPlayers.filter((p) => p.position === pos).length;
        const required = roster[pos as keyof RosterSettings] || 0;
        if (currentCount < required) {
          needsCount[pos] = (needsCount[pos] || 0) + 1;
        }
      });
    }
  }

  return { teamsPickingBeforeNext, needsCount };
}

// Calculate user positional need score (0-100)
function calculatePositionalNeed(
  position: string,
  userPlayers: Player[],
  roster: RosterSettings
): number {
  const currentCount = userPlayers.filter((p) => p.position === position).length;
  const required = roster[position as keyof RosterSettings] || 0;

  if (required === 0) {
    if (position === "QB" && roster.SUPERFLEX > 0) return 75; // superflex value
    return 10; // no starting spots
  }

  // Need index based on how many required spots are open
  const openStarterSpots = required - currentCount;

  if (openStarterSpots > 0) {
    // 100 if we have 0 players at a position we need starters for
    if (currentCount === 0) return 100;
    // Scale based on percentage of spots filled
    return Math.round((openStarterSpots / required) * 90);
  }

  // Starters are filled, we are drafting for bench/flex
  const flexRequired = roster.FLEX || 0;
  if ((position === "RB" || position === "WR" || position === "TE") && flexRequired > 0) {
    const flexStarters = userPlayers.filter((p) => p.position === "RB" || p.position === "WR" || p.position === "TE").length - (roster.RB + roster.WR + roster.TE);
    if (flexStarters < flexRequired) {
      return 50; // Flex depth is good
    }
  }

  // Backups
  if (position === "QB" || position === "TE") {
    // Limit backups for single-starter slots in MVP
    if (currentCount >= required + 1) return 15; // penalty for too many QBs/TEs
    return 40; // backup QB/TE is nice
  }

  // RB/WR depth is always valuable
  if (position === "RB" || position === "WR") {
    const totalBenchCount = userPlayers.length - (roster.QB + roster.RB + roster.WR + roster.TE + roster.K + roster.DST + roster.FLEX + roster.SUPERFLEX);
    if (totalBenchCount >= roster.BENCH) return 20; // roster full
    return Math.max(25, 65 - currentCount * 8); // declines as we add more depth
  }

  return 20;
}

// Text generator helper to create explainable reports
function generateExplanationText(player: Player, facts: any): string {
  const { position, teamNeed, tierStatus, opponentPressure, survivalProbability, adpValue } = facts;

  if (teamNeed === "High") {
    return `${player.name} is the best pick because he fills your biggest roster need at ${position}. He is currently ${tierStatus.toLowerCase()}, and there is a high chance (${100 - survivalProbability}% likelihood) he will be drafted by your next turn, with ${opponentPressure.toLowerCase()}.`;
  }

  if (adpValue.includes("value")) {
    return `${player.name} represents incredible value here at pick ${adpValue}. He is currently ${tierStatus.toLowerCase()} and is projected for ${player.projectedPoints} points. Given that ${opponentPressure.toLowerCase()}, it is highly recommended to take him now rather than risking waiting.`;
  }

  if (tierStatus.includes("Last")) {
    return `This is a tier cliff warning at ${position}. ${player.name} is the ${tierStatus.toLowerCase()} left on the board. With ${opponentPressure.toLowerCase()}, there is only a ${survivalProbability}% chance he survives until your next pick. Grab him now to lock in this talent tier.`;
  }

  return `${player.name} is a solid selection here (${adpValue}). He is ${tierStatus.toLowerCase()}, providing a stable projection of ${player.projectedPoints} points. At this point in the draft, this pick balances your ${position} roster needs and board value.`;
}
