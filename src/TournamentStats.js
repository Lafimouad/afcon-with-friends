import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function TournamentStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get all matches
      const { data: matches, error: matchError } = await supabase.from(
        "matches",
      ).select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
          away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
        `);

      if (matchError) throw matchError;

      // Get all predictions
      const { data: predictions, error: predError } = await supabase.from(
        "predictions",
      ).select(`
          *,
          user:profiles(username)
        `);

      if (predError) throw predError;

      // Get all players
      const { data: players, error: playersError } = await supabase
        .from("profiles")
        .select("*")
        .order("total_points", { ascending: false });

      if (playersError) throw playersError;

      // Calculate fun stats
      const totalMatches = matches.filter((m) => m.is_completed).length;
      const totalPredictions = predictions.length;
      const totalGoalsScored = matches
        .filter((m) => m.is_completed)
        .reduce((sum, m) => sum + (m.home_score || 0) + (m.away_score || 0), 0);

      // Perfect predictions (exact score) - check for both old (10) and new (20) point values
      const perfectPredictions = predictions.filter((p) => {
        const match = matches.find((m) => m.id === p.match_id);
        return (
          match?.is_completed &&
          p.predicted_home_score === match.home_score &&
          p.predicted_away_score === match.away_score
        );
      });

      // Most accurate player
      const perfectByPlayer = {};
      perfectPredictions.forEach((p) => {
        const username = p.user.username;
        perfectByPlayer[username] = (perfectByPlayer[username] || 0) + 1;
      });

      const mostAccurate = Object.entries(perfectByPlayer).sort(
        (a, b) => b[1] - a[1],
      )[0];

      // Most popular prediction
      const predictionCounts = {};
      predictions.forEach((p) => {
        const key = `${p.predicted_home_score}-${p.predicted_away_score}`;
        predictionCounts[key] = (predictionCounts[key] || 0) + 1;
      });

      const mostPopular = Object.entries(predictionCounts).sort(
        (a, b) => b[1] - a[1],
      )[0];

      // Highest scoring match
      const highestScoring = matches
        .filter((m) => m.is_completed)
        .sort(
          (a, b) =>
            (b.home_score || 0) +
            (b.away_score || 0) -
            ((a.home_score || 0) + (a.away_score || 0)),
        )[0];

      // Biggest upset (most wrong predictions)
      const upsets = matches
        .filter((m) => m.is_completed)
        .map((match) => {
          const matchPreds = predictions.filter((p) => p.match_id === match.id);
          const wrongPreds = matchPreds.filter((p) => {
            const predWinner =
              p.predicted_home_score > p.predicted_away_score
                ? "home"
                : p.predicted_home_score < p.predicted_away_score
                  ? "away"
                  : "draw";
            const actualWinner =
              match.home_score > match.away_score
                ? "home"
                : match.home_score < match.away_score
                  ? "away"
                  : "draw";
            return predWinner !== actualWinner;
          });
          return {
            match,
            wrongCount: wrongPreds.length,
            totalPreds: matchPreds.length,
          };
        })
        .sort((a, b) => b.wrongCount - a.wrongCount)[0];

      // Average points per player
      const avgPoints =
        players.reduce((sum, p) => sum + p.total_points, 0) / players.length;

      // Point spread
      const pointSpread =
        players.length > 0
          ? players[0].total_points - players[players.length - 1].total_points
          : 0;

      // Most optimistic player (predicted highest total goals)
      const playerGoalTotals = {};
      predictions.forEach((p) => {
        const username = players.find((pl) => pl.id === p.user_id)?.username;
        if (username) {
          playerGoalTotals[username] =
            (playerGoalTotals[username] || 0) +
            p.predicted_home_score +
            p.predicted_away_score;
        }
      });
      const mostOptimistic = Object.entries(playerGoalTotals).sort(
        (a, b) => b[1] - a[1],
      )[0];

      // Most pessimistic player (predicted lowest total goals)
      const mostPessimistic = Object.entries(playerGoalTotals).sort(
        (a, b) => a[1] - b[1],
      )[0];

      // Prediction accuracy (% of correct winner predictions)
      const correctWinners = predictions.filter((p) => {
        const match = matches.find((m) => m.id === p.match_id);
        if (!match?.is_completed) return false;
        const predWinner =
          p.predicted_home_score > p.predicted_away_score
            ? "home"
            : p.predicted_home_score < p.predicted_away_score
              ? "away"
              : "draw";
        const actualWinner =
          match.home_score > match.away_score
            ? "home"
            : match.home_score < match.away_score
              ? "away"
              : "draw";
        return predWinner === actualWinner;
      }).length;
      const accuracyRate =
        totalPredictions > 0
          ? Math.round((correctWinners / totalPredictions) * 100)
          : 0;

      // Most consistent player (got points on most matches)
      const playerSuccessRate = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const successfulPreds = playerPreds.filter(
            (p) => p.points_earned > 0,
          ).length;
          return {
            username: player.username,
            rate:
              playerPreds.length > 0
                ? Math.round((successfulPreds / playerPreds.length) * 100)
                : 0,
            count: successfulPreds,
          };
        })
        .sort((a, b) => b.rate - a.rate)[0];

      // Draw stats
      const actualDraws = matches.filter(
        (m) => m.is_completed && m.home_score === m.away_score,
      ).length;
      const predictedDraws = predictions.filter(
        (p) => p.predicted_home_score === p.predicted_away_score,
      ).length;

      // Closest match (smallest goal difference)
      const closestMatch = matches
        .filter((m) => m.is_completed && m.home_score !== m.away_score)
        .sort(
          (a, b) =>
            Math.abs(a.home_score - a.away_score) -
            Math.abs(b.home_score - b.away_score),
        )[0];

      // Biggest blowout
      const biggestBlowout = matches
        .filter((m) => m.is_completed)
        .sort(
          (a, b) =>
            Math.abs(b.home_score - b.away_score) -
            Math.abs(a.home_score - a.away_score),
        )[0];

      // Total goals predicted vs actual
      const totalGoalsPredicted = predictions.reduce(
        (sum, p) => sum + p.predicted_home_score + p.predicted_away_score,
        0,
      );

      setStats({
        totalMatches,
        totalPredictions,
        totalGoalsScored,
        perfectPredictionsCount: perfectPredictions.length,
        mostAccurate: mostAccurate
          ? { username: mostAccurate[0], count: mostAccurate[1] }
          : null,
        mostPopular: mostPopular
          ? { score: mostPopular[0], count: mostPopular[1] }
          : null,
        highestScoring,
        biggestUpset: upsets,
        avgPoints: Math.round(avgPoints),
        pointSpread,
        totalPlayers: players.length,
        winner: players[0],
        topThree: players.slice(0, 3),
        mostOptimistic,
        mostPessimistic,
        accuracyRate,
        mostConsistent: playerSuccessRate,
        actualDraws,
        predictedDraws,
        closestMatch,
        biggestBlowout,
        totalGoalsPredicted,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading tournament stats...</div>;
  }

  if (!stats) {
    return <div className="error">Failed to load stats</div>;
  }

  return (
    <div className="tournament-stats">
      <h2>🏆 AFCON 2025 Tournament Stats</h2>

      <div className="stats-grid">
        {/* Tournament Champion */}
        <div className="stat-card champion-card">
          <h3>🏆 Tournament Champion</h3>
          <div className="champion-name">{stats.winner?.username}</div>
          <div className="champion-points">
            {stats.winner?.total_points} points
          </div>
        </div>

        {/* Top 3 */}
        <div className="stat-card">
          <h3>🥇 Top 3 Finishers</h3>
          <div className="top-three">
            {stats.topThree.map((player, idx) => (
              <div key={player.id} className="top-player">
                <span className="medal">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                </span>
                <span className="name">{player.username}</span>
                <span className="pts">{player.total_points} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* General Stats */}
        <div className="stat-card">
          <h3>📊 By The Numbers</h3>
          <div className="stat-list">
            <div className="stat-item">
              <span className="label">Total Matches:</span>
              <span className="value">{stats.totalMatches}</span>
            </div>
            <div className="stat-item">
              <span className="label">Total Predictions:</span>
              <span className="value">{stats.totalPredictions}</span>
            </div>
            <div className="stat-item">
              <span className="label">Total Goals:</span>
              <span className="value">{stats.totalGoalsScored}</span>
            </div>
            <div className="stat-item">
              <span className="label">Average Points:</span>
              <span className="value">{stats.avgPoints}</span>
            </div>
            <div className="stat-item">
              <span className="label">Point Spread:</span>
              <span className="value">{stats.pointSpread}</span>
            </div>
          </div>
        </div>

        {/* Perfect Predictions */}
        <div className="stat-card">
          <h3>🎯 Perfect Predictions</h3>
          <div className="stat-highlight">
            <div className="big-number">{stats.perfectPredictionsCount}</div>
            <div className="stat-desc">Exact score predictions</div>
          </div>
          {stats.mostAccurate && (
            <div className="stat-detail">
              <strong>{stats.mostAccurate.username}</strong> had the most with{" "}
              <strong>{stats.mostAccurate.count}</strong> perfect predictions!
              🎯
            </div>
          )}
        </div>

        {/* Most Popular Prediction */}
        {stats.mostPopular && (
          <div className="stat-card">
            <h3>📈 Most Popular Prediction</h3>
            <div className="stat-highlight">
              <div className="big-number">{stats.mostPopular.score}</div>
              <div className="stat-desc">
                Predicted {stats.mostPopular.count} times
              </div>
            </div>
          </div>
        )}

        {/* Highest Scoring Match */}
        {stats.highestScoring && (
          <div className="stat-card">
            <h3>⚽ Highest Scoring Match</h3>
            <div className="match-display">
              <div className="teams">
                {stats.highestScoring.home_team.flag_emoji}{" "}
                {stats.highestScoring.home_team.name}
                <strong className="score">
                  {" "}
                  {stats.highestScoring.home_score} -{" "}
                  {stats.highestScoring.away_score}{" "}
                </strong>
                {stats.highestScoring.away_team.flag_emoji}{" "}
                {stats.highestScoring.away_team.name}
              </div>
              <div className="total-goals">
                Total:{" "}
                {stats.highestScoring.home_score +
                  stats.highestScoring.away_score}{" "}
                goals
              </div>
            </div>
          </div>
        )}

        {/* Biggest Upset */}
        {stats.biggestUpset && stats.biggestUpset.wrongCount > 0 && (
          <div className="stat-card">
            <h3>😱 Biggest Upset</h3>
            <div className="match-display">
              <div className="teams">
                {stats.biggestUpset.match.home_team.flag_emoji}{" "}
                {stats.biggestUpset.match.home_team.name}
                <strong className="score">
                  {" "}
                  {stats.biggestUpset.match.home_score} -{" "}
                  {stats.biggestUpset.match.away_score}{" "}
                </strong>
                {stats.biggestUpset.match.away_team.flag_emoji}{" "}
                {stats.biggestUpset.match.away_team.name}
              </div>
              <div className="upset-detail">
                {stats.biggestUpset.wrongCount} out of{" "}
                {stats.biggestUpset.totalPreds} got it wrong!
              </div>
            </div>
          </div>
        )}

        {/* Fun Fact */}
        <div className="stat-card fun-fact">
          <h3>💡 Fun Facts</h3>
          <p>
            On average, each player made{" "}
            <strong>
              {Math.round(stats.totalPredictions / stats.totalPlayers)}
            </strong>{" "}
            predictions throughout the tournament!
          </p>
          <p>
            Goals per match:{" "}
            <strong>
              {(stats.totalGoalsScored / stats.totalMatches).toFixed(1)}
            </strong>
          </p>
          <p>
            Prediction accuracy: <strong>{stats.accuracyRate}%</strong> got the
            winner right!
          </p>
          <p>
            We predicted <strong>{stats.totalGoalsPredicted}</strong> total
            goals, but only <strong>{stats.totalGoalsScored}</strong> were
            scored (
            {stats.totalGoalsPredicted > stats.totalGoalsScored
              ? `${stats.totalGoalsPredicted - stats.totalGoalsScored} too optimistic! 😅`
              : `${stats.totalGoalsScored - stats.totalGoalsPredicted} goals short! 🤯`}
            )
          </p>
        </div>

        {/* Most Optimistic */}
        {stats.mostOptimistic && (
          <div className="stat-card">
            <h3>😃 Most Optimistic</h3>
            <div className="stat-detail">
              <strong>{stats.mostOptimistic[0]}</strong> predicted the most
              goals with <strong>{stats.mostOptimistic[1]}</strong> total goals
              across all matches!
            </div>
          </div>
        )}

        {/* Most Pessimistic */}
        {stats.mostPessimistic && (
          <div className="stat-card">
            <h3>😐 Most Pessimistic</h3>
            <div className="stat-detail">
              <strong>{stats.mostPessimistic[0]}</strong> kept it low-scoring
              with only <strong>{stats.mostPessimistic[1]}</strong> total
              predicted goals!
            </div>
          </div>
        )}

        {/* Most Consistent */}
        {stats.mostConsistent && (
          <div className="stat-card">
            <h3>🎯 Most Consistent</h3>
            <div className="stat-detail">
              <strong>{stats.mostConsistent.username}</strong> got points on{" "}
              <strong>{stats.mostConsistent.rate}%</strong> of their predictions
              ({stats.mostConsistent.count} matches)!
            </div>
          </div>
        )}

        {/* Draw Stats */}
        <div className="stat-card">
          <h3>🤝 Draw Predictions</h3>
          <div className="stat-list">
            <div className="stat-item">
              <span className="label">Actual Draws:</span>
              <span className="value">{stats.actualDraws}</span>
            </div>
            <div className="stat-item">
              <span className="label">Predicted Draws:</span>
              <span className="value">{stats.predictedDraws}</span>
            </div>
          </div>
          {stats.predictedDraws > stats.actualDraws && (
            <div className="stat-detail" style={{ marginTop: "0.5rem" }}>
              We were expecting more ties! 🤷
            </div>
          )}
          {stats.predictedDraws < stats.actualDraws && (
            <div className="stat-detail" style={{ marginTop: "0.5rem" }}>
              More draws than expected! 😮
            </div>
          )}
        </div>

        {/* Closest Match */}
        {stats.closestMatch && (
          <div className="stat-card">
            <h3>🔥 Closest Match</h3>
            <div className="match-display">
              <div className="teams">
                {stats.closestMatch.home_team.flag_emoji}{" "}
                {stats.closestMatch.home_team.name}
                <strong className="score">
                  {" "}
                  {stats.closestMatch.home_score} -{" "}
                  {stats.closestMatch.away_score}{" "}
                </strong>
                {stats.closestMatch.away_team.flag_emoji}{" "}
                {stats.closestMatch.away_team.name}
              </div>
              <div className="total-goals">
                Decided by just{" "}
                {Math.abs(
                  stats.closestMatch.home_score - stats.closestMatch.away_score,
                )}{" "}
                goal!
              </div>
            </div>
          </div>
        )}

        {/* Biggest Blowout */}
        {stats.biggestBlowout &&
          Math.abs(
            stats.biggestBlowout.home_score - stats.biggestBlowout.away_score,
          ) > 1 && (
            <div className="stat-card">
              <h3>💥 Biggest Blowout</h3>
              <div className="match-display">
                <div className="teams">
                  {stats.biggestBlowout.home_team.flag_emoji}{" "}
                  {stats.biggestBlowout.home_team.name}
                  <strong className="score">
                    {" "}
                    {stats.biggestBlowout.home_score} -{" "}
                    {stats.biggestBlowout.away_score}{" "}
                  </strong>
                  {stats.biggestBlowout.away_team.flag_emoji}{" "}
                  {stats.biggestBlowout.away_team.name}
                </div>
                <div className="total-goals">
                  Goal difference:{" "}
                  {Math.abs(
                    stats.biggestBlowout.home_score -
                      stats.biggestBlowout.away_score,
                  )}{" "}
                  goals! 🚀
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
