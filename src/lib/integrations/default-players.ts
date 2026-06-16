export interface DefaultPlayer {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  byeWeek: number;
  injuryStatus: string | null;
  overallRank: number;
  positionRank: number;
  projectedPoints: number;
  adp: number;
  tier: number;
  riskScore: number;
  notes: string;
}

export function getDefaultOfflinePlayers(): DefaultPlayer[] {
  const playersData = [
    // Tier 1
    { name: "Christian McCaffrey", position: "RB", nflTeam: "SF", byeWeek: 9, overallRank: 1, positionRank: 1, projectedPoints: 324.5, adp: 1.2, tier: 1, riskScore: 1.5, notes: "Elite dual-threat running back in a high-powered offense." },
    { name: "CeeDee Lamb", position: "WR", nflTeam: "DAL", byeWeek: 7, overallRank: 2, positionRank: 1, projectedPoints: 310.2, adp: 2.4, tier: 1, riskScore: 2.0, notes: "Top targeted wideout in Dallas with massive target volume." },
    { name: "Tyreek Hill", position: "WR", nflTeam: "MIA", byeWeek: 6, overallRank: 3, positionRank: 2, projectedPoints: 305.8, adp: 3.1, tier: 1, riskScore: 2.5, notes: "Unrivaled speed and explosive play potential." },
    { name: "Justin Jefferson", position: "WR", nflTeam: "MIN", byeWeek: 6, overallRank: 4, positionRank: 3, projectedPoints: 298.4, adp: 4.5, tier: 1, riskScore: 2.1, notes: "Highly skilled receiver, QB transition is the only minor concern." },
    { name: "Ja'Marr Chase", position: "WR", nflTeam: "CIN", byeWeek: 12, overallRank: 5, positionRank: 4, projectedPoints: 295.1, adp: 5.2, tier: 1, riskScore: 1.8, notes: "Elite connection with Burrow makes him a top tier option." },
    { name: "Breece Hall", position: "RB", nflTeam: "NYJ", byeWeek: 12, overallRank: 6, positionRank: 2, projectedPoints: 288.6, adp: 6.8, tier: 1, riskScore: 2.2, notes: "Workhorse back with high target share in the passing game." },
    { name: "Amon-Ra St. Brown", position: "WR", nflTeam: "DET", byeWeek: 5, overallRank: 7, positionRank: 5, projectedPoints: 286.3, adp: 7.5, tier: 1, riskScore: 1.2, notes: "Extremely safe floor, focal point of the Lions passing attack." },
    { name: "Bijan Robinson", position: "RB", nflTeam: "ATL", byeWeek: 12, overallRank: 8, positionRank: 3, projectedPoints: 282.1, adp: 8.1, tier: 1, riskScore: 1.6, notes: "Expected to take on a massive workhorse role this season." },
    
    // Tier 2
    { name: "Saquon Barkley", position: "RB", nflTeam: "PHI", byeWeek: 5, overallRank: 9, positionRank: 4, projectedPoints: 265.4, adp: 10.2, tier: 2, riskScore: 2.8, notes: "Upgraded offensive line in Philly should boost efficiency." },
    { name: "Jahmyr Gibbs", position: "RB", nflTeam: "DET", byeWeek: 5, overallRank: 10, positionRank: 5, projectedPoints: 258.9, adp: 11.5, tier: 2, riskScore: 2.3, notes: "Explosive runner shared backfield but gets high-value touches." },
    { name: "Jonathan Taylor", position: "RB", nflTeam: "IND", byeWeek: 14, overallRank: 11, positionRank: 6, projectedPoints: 254.2, adp: 12.8, tier: 2, riskScore: 2.0, notes: "Workhorse running back behind a strong offensive line." },
    { name: "A.J. Brown", position: "WR", nflTeam: "PHI", byeWeek: 5, overallRank: 12, positionRank: 6, projectedPoints: 252.1, adp: 13.5, tier: 2, riskScore: 1.9, notes: "Physical wideout with high touchdown upside." },
    { name: "Puka Nacua", position: "WR", nflTeam: "LAR", byeWeek: 6, overallRank: 13, positionRank: 7, projectedPoints: 248.5, adp: 14.8, tier: 2, riskScore: 2.6, notes: "Sensational rookie season breakout, look to build on it." },
    { name: "Garrett Wilson", position: "WR", nflTeam: "NYJ", byeWeek: 12, overallRank: 14, positionRank: 8, projectedPoints: 245.2, adp: 15.9, tier: 2, riskScore: 2.1, notes: "Major upgrade at QB should unlock his elite talent." },
    { name: "Marvin Harrison Jr.", position: "WR", nflTeam: "ARI", byeWeek: 11, overallRank: 15, positionRank: 9, projectedPoints: 238.1, adp: 18.2, tier: 2, riskScore: 3.0, notes: "Rookie sensation with immediate WR1 upside in Arizona." },
    
    // Tier 3 (QBs start)
    { name: "Josh Allen", position: "QB", nflTeam: "BUF", byeWeek: 12, overallRank: 16, positionRank: 1, projectedPoints: 395.2, adp: 21.4, tier: 3, riskScore: 1.5, notes: "Elite fantasy QB with unmatched rushing touchdown floor." },
    { name: "Jalen Hurts", position: "QB", nflTeam: "PHI", byeWeek: 5, overallRank: 17, positionRank: 2, projectedPoints: 388.4, adp: 22.8, tier: 3, riskScore: 1.8, notes: "Tush push machine and dynamic arm in Philly." },
    { name: "Patrick Mahomes", position: "QB", nflTeam: "KC", byeWeek: 6, overallRank: 18, positionRank: 3, projectedPoints: 378.1, adp: 26.5, tier: 3, riskScore: 1.1, notes: "High real-life efficiency, upgraded receiver room." },
    { name: "Kyren Williams", position: "RB", nflTeam: "LAR", byeWeek: 6, overallRank: 19, positionRank: 7, projectedPoints: 232.4, adp: 20.1, tier: 3, riskScore: 3.2, notes: "Stunning volume, though backup Corum adds minor risk." },
    { name: "Drake London", position: "WR", nflTeam: "ATL", byeWeek: 12, overallRank: 20, positionRank: 10, projectedPoints: 228.6, adp: 23.4, tier: 3, riskScore: 2.4, notes: "Kirk Cousins upgrade will unlock this physical red zone target." },
    { name: "Travis Etienne", position: "RB", nflTeam: "JAX", byeWeek: 12, overallRank: 21, positionRank: 8, projectedPoints: 225.1, adp: 24.5, tier: 3, riskScore: 2.1, notes: "Versatile back who dominates snaps in Jacksonville." },
    { name: "Derrick Henry", position: "RB", nflTeam: "BAL", byeWeek: 14, overallRank: 22, positionRank: 9, projectedPoints: 224.8, adp: 25.9, tier: 3, riskScore: 2.5, notes: "King Henry on the Ravens is a double-digit TD threat." },
    { name: "Davante Adams", position: "WR", nflTeam: "LV", byeWeek: 10, overallRank: 23, positionRank: 11, projectedPoints: 221.7, adp: 27.2, tier: 3, riskScore: 2.2, notes: "Still elite route runner, but QB play capping ceiling." },
    { name: "Chris Olave", position: "WR", nflTeam: "NO", byeWeek: 12, overallRank: 24, positionRank: 12, projectedPoints: 220.3, adp: 28.5, tier: 3, riskScore: 1.9, notes: "Primary target earner in New Orleans ready for leap." },
    
    // Tier 4 (Tight Ends)
    { name: "Sam LaPorta", position: "TE", nflTeam: "DET", byeWeek: 5, overallRank: 25, positionRank: 1, projectedPoints: 210.4, adp: 29.8, tier: 4, riskScore: 2.0, notes: "Historic rookie season. Hard to repeat but he's TE1." },
    { name: "Travis Kelce", position: "TE", nflTeam: "KC", byeWeek: 6, overallRank: 26, positionRank: 2, projectedPoints: 208.2, adp: 30.5, tier: 4, riskScore: 2.4, notes: "Slight age decline but remains Mahomes' favorite target." },
    { name: "Trey McBride", position: "TE", nflTeam: "ARI", byeWeek: 11, overallRank: 27, positionRank: 3, projectedPoints: 204.6, adp: 34.2, tier: 4, riskScore: 2.2, notes: "Dominated targets down the stretch last year." },
    { name: "Lamar Jackson", position: "QB", nflTeam: "BAL", byeWeek: 14, overallRank: 28, positionRank: 4, projectedPoints: 365.2, adp: 32.1, tier: 4, riskScore: 2.3, notes: "Reigning MVP with elite rushing floor." },
    { name: "Isiah Pacheco", position: "RB", nflTeam: "KC", byeWeek: 6, overallRank: 29, positionRank: 10, projectedPoints: 215.1, adp: 31.2, tier: 4, riskScore: 1.7, notes: "Violent runner with locked-in volume in KC." },
    { name: "Deebo Samuel", position: "WR", nflTeam: "SF", byeWeek: 9, overallRank: 30, positionRank: 13, projectedPoints: 212.8, adp: 33.5, tier: 4, riskScore: 2.9, notes: "Versatile gadget weapon, high injury risk but high upside." },
    { name: "Mike Evans", position: "WR", nflTeam: "TB", byeWeek: 11, overallRank: 31, positionRank: 14, projectedPoints: 211.5, adp: 35.1, tier: 4, riskScore: 1.8, notes: "Consistent 1,000 yard receiver and elite TD scorer." },
    { name: "Nico Collins", position: "WR", nflTeam: "HOU", byeWeek: 14, overallRank: 32, positionRank: 15, projectedPoints: 210.1, adp: 36.4, tier: 4, riskScore: 2.5, notes: "Houston's top target but Diggs arrival adds competition." },
    { name: "Brandon Aiyuk", position: "WR", nflTeam: "SF", byeWeek: 9, overallRank: 33, positionRank: 16, projectedPoints: 209.4, adp: 38.0, tier: 4, riskScore: 2.0, notes: "Highly efficient route runner in Kyle Shanahan's system." },
    { name: "James Cook", position: "RB", nflTeam: "BUF", byeWeek: 12, overallRank: 34, positionRank: 11, projectedPoints: 208.5, adp: 39.2, tier: 4, riskScore: 2.1, notes: "Efficient runner who serves as a key checkdown option." },
    { name: "Rachaad White", position: "RB", nflTeam: "TB", byeWeek: 11, overallRank: 35, positionRank: 12, projectedPoints: 207.2, adp: 41.5, tier: 4, riskScore: 2.2, notes: "Volume-based RB who excels in PPR formats." },
    
    // Tier 5
    { name: "Josh Jacobs", position: "RB", nflTeam: "GB", byeWeek: 10, overallRank: 36, positionRank: 13, projectedPoints: 202.4, adp: 42.8, tier: 5, riskScore: 2.4, notes: "Takes over the Aaron Jones role in Green Bay's offense." },
    { name: "Kenneth Walker", position: "RB", nflTeam: "SEA", byeWeek: 10, overallRank: 37, positionRank: 14, projectedPoints: 198.5, adp: 44.5, tier: 5, riskScore: 2.6, notes: "Dynamic runner, but Zach Charbonnet caps his volume." },
    { name: "DK Metcalf", position: "WR", nflTeam: "SEA", byeWeek: 10, overallRank: 38, positionRank: 17, projectedPoints: 196.2, adp: 45.2, tier: 5, riskScore: 1.7, notes: "Elite physical receiver, huge red zone weapon." },
    { name: "Stefon Diggs", position: "WR", nflTeam: "HOU", byeWeek: 14, overallRank: 39, positionRank: 18, projectedPoints: 195.4, adp: 46.8, tier: 5, riskScore: 2.7, notes: "Veteran WR joins CJ Stroud, targets will be split." },
    { name: "Mark Andrews", position: "TE", nflTeam: "BAL", byeWeek: 14, overallRank: 40, positionRank: 4, projectedPoints: 188.5, adp: 48.1, tier: 5, riskScore: 2.5, notes: "Lamar Jackson's security blanket, reliable TE option." },
    { name: "Dalton Kincaid", position: "TE", nflTeam: "BUF", byeWeek: 12, overallRank: 41, positionRank: 5, projectedPoints: 185.2, adp: 49.5, tier: 5, riskScore: 2.1, notes: "Stepping into a larger target share role in Buffalo." },
    { name: "C.J. Stroud", position: "QB", nflTeam: "HOU", byeWeek: 14, overallRank: 42, positionRank: 5, projectedPoints: 342.1, adp: 52.4, tier: 5, riskScore: 1.4, notes: "Rising star with an upgraded weapons closet." },
    { name: "Anthony Richardson", position: "QB", nflTeam: "IND", byeWeek: 14, overallRank: 43, positionRank: 6, projectedPoints: 338.9, adp: 54.2, tier: 5, riskScore: 3.8, notes: "Massive rushing ceiling but significant injury risk." },
    { name: "Joe Mixon", position: "RB", nflTeam: "HOU", byeWeek: 14, overallRank: 44, positionRank: 15, projectedPoints: 190.2, adp: 53.5, tier: 5, riskScore: 2.0, notes: "Workhorse back moves to high-scoring Texans offense." },
    { name: "Alvin Kamara", position: "RB", nflTeam: "NO", byeWeek: 12, overallRank: 45, positionRank: 16, projectedPoints: 188.9, adp: 55.1, tier: 5, riskScore: 2.3, notes: "PPR volume goldmine in checking down offense." },
    
    // Tier 6
    { name: "George Kittle", position: "TE", nflTeam: "SF", byeWeek: 9, overallRank: 46, positionRank: 6, projectedPoints: 175.4, adp: 58.2, tier: 6, riskScore: 2.6, notes: "Boom-or-bust tight end who is highly efficient." },
    { name: "Kyle Pitts", position: "TE", nflTeam: "ATL", byeWeek: 12, overallRank: 47, positionRank: 7, projectedPoints: 172.1, adp: 60.1, tier: 6, riskScore: 3.0, notes: "Talented TE whose value gets resurrected by Cousins." },
    { name: "Amari Cooper", position: "WR", nflTeam: "CLE", byeWeek: 10, overallRank: 48, positionRank: 19, projectedPoints: 185.1, adp: 59.4, tier: 6, riskScore: 2.2, notes: "Experienced route runner who is the top target in Cleveland." },
    { name: "Michael Pittman Jr.", position: "WR", nflTeam: "IND", byeWeek: 14, overallRank: 49, positionRank: 20, projectedPoints: 183.2, adp: 61.2, tier: 6, riskScore: 1.6, notes: "Consistent target earner, but Richardson rushing limits ceiling." },
    { name: "D'Andre Swift", position: "RB", nflTeam: "CHI", byeWeek: 7, overallRank: 50, positionRank: 17, projectedPoints: 178.6, adp: 63.8, tier: 6, riskScore: 2.8, notes: "Signed rich contract to lead the Bears backfield." },
    { name: "James Conner", position: "RB", nflTeam: "ARI", byeWeek: 11, overallRank: 51, positionRank: 18, projectedPoints: 176.5, adp: 65.2, tier: 6, riskScore: 2.6, notes: "Workhorse back but cards drafted Benson behind him." },
    { name: "Patrick Mahomes", position: "QB", nflTeam: "KC", byeWeek: 6, overallRank: 52, positionRank: 7, projectedPoints: 330.1, adp: 64.2, tier: 6, riskScore: 1.2, notes: "Super solid floor quarterback." },
    { name: "Jordan Love", position: "QB", nflTeam: "GB", byeWeek: 10, overallRank: 53, positionRank: 8, projectedPoints: 328.6, adp: 66.8, tier: 6, riskScore: 2.0, notes: "Showed elite potential in the second half of last season." },
    
    // Tier 7
    { name: "Najee Harris", position: "RB", nflTeam: "PIT", byeWeek: 9, overallRank: 54, positionRank: 19, projectedPoints: 168.4, adp: 68.2, tier: 7, riskScore: 1.9, notes: "Safe volume, but Warren splits high-value touches." },
    { name: "David Montgomery", position: "RB", nflTeam: "DET", byeWeek: 5, overallRank: 55, positionRank: 20, projectedPoints: 165.2, adp: 70.1, tier: 7, riskScore: 1.8, notes: "Excellent goal line back, touchdown dependent." },
    { name: "Rhamondre Stevenson", position: "RB", nflTeam: "NE", byeWeek: 14, overallRank: 56, positionRank: 21, projectedPoints: 164.3, adp: 71.4, tier: 7, riskScore: 2.4, notes: "Volume back in rebuilding Patriots offense." },
    { name: "Zay Flowers", position: "WR", nflTeam: "BAL", byeWeek: 14, overallRank: 57, positionRank: 21, projectedPoints: 175.2, adp: 69.5, tier: 7, riskScore: 1.9, notes: "Lions-share of Ravens wideout targets." },
    { name: "Tee Higgins", position: "WR", nflTeam: "CIN", byeWeek: 12, overallRank: 58, positionRank: 22, projectedPoints: 172.9, adp: 72.5, tier: 7, riskScore: 2.8, notes: "High ceiling WR2 playing on franchise tag." },
    { name: "DeVonta Smith", position: "WR", nflTeam: "PHI", byeWeek: 5, overallRank: 59, positionRank: 23, projectedPoints: 171.4, adp: 73.1, tier: 7, riskScore: 1.7, notes: "Highly talented WR2 in Philadelphia." },
    { name: "George Pickens", position: "WR", nflTeam: "PIT", byeWeek: 9, overallRank: 60, positionRank: 24, projectedPoints: 168.5, adp: 75.9, tier: 7, riskScore: 2.6, notes: "Enormous big-play talent, top receiver in Pittsburgh." },

    // Kickers & Defense (Fallback items)
    { name: "Justin Tucker", position: "K", nflTeam: "BAL", byeWeek: 14, overallRank: 130, positionRank: 1, projectedPoints: 142.1, adp: 135.2, tier: 9, riskScore: 1.0, notes: "Most reliable kicker in NFL history." },
    { name: "Harrison Butker", position: "K", nflTeam: "KC", byeWeek: 6, overallRank: 132, positionRank: 2, projectedPoints: 138.4, adp: 140.1, tier: 9, riskScore: 1.1, notes: "Consistent scoring opportunities in Kansas City." },
    { name: "Brandon Aubrey", position: "K", nflTeam: "DAL", byeWeek: 7, overallRank: 135, positionRank: 3, projectedPoints: 136.2, adp: 144.5, tier: 9, riskScore: 1.2, notes: "Record-breaking rookie season breakout kicker." },
    { name: "San Francisco 49ers", position: "DST", nflTeam: "SF", byeWeek: 9, overallRank: 120, positionRank: 1, projectedPoints: 125.4, adp: 125.1, tier: 9, riskScore: 1.3, notes: "Elite defensive front line force." },
    { name: "Dallas Cowboys", position: "DST", nflTeam: "DAL", byeWeek: 7, overallRank: 122, positionRank: 2, projectedPoints: 122.8, adp: 128.5, tier: 9, riskScore: 1.5, notes: "High sack and interception rate under Dan Quinn legacy." },
    { name: "Baltimore Ravens", position: "DST", nflTeam: "BAL", byeWeek: 14, overallRank: 125, positionRank: 3, projectedPoints: 120.2, adp: 131.2, tier: 9, riskScore: 1.2, notes: "Tough unit that plays excellent team defense." }
  ];

  return playersData.map((p, idx) => ({
    id: `default-player-${idx + 1}`,
    name: p.name,
    position: p.position,
    nflTeam: p.nflTeam,
    byeWeek: p.byeWeek,
    injuryStatus: null,
    overallRank: p.overallRank,
    positionRank: p.positionRank,
    projectedPoints: p.projectedPoints,
    adp: p.adp,
    tier: p.tier,
    riskScore: p.riskScore,
    notes: p.notes
  }));
}
