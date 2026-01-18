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

      // Hot Streak - Longest consecutive predictions with points
      const hotStreaks = players
        .map((player) => {
          const playerPreds = predictions
            .filter((p) => p.user_id === player.id)
            .sort((a, b) => {
              const matchA = matches.find((m) => m.id === a.match_id);
              const matchB = matches.find((m) => m.id === b.match_id);
              return (
                new Date(matchA?.match_date) - new Date(matchB?.match_date)
              );
            });

          let currentStreak = 0;
          let maxStreak = 0;
          playerPreds.forEach((p) => {
            if (p.points_earned > 0) {
              currentStreak++;
              maxStreak = Math.max(maxStreak, currentStreak);
            } else {
              currentStreak = 0;
            }
          });

          return { username: player.username, streak: maxStreak };
        })
        .sort((a, b) => b.streak - a.streak)[0];

      // Cold Streak - Longest run without points
      const coldStreaks = players
        .map((player) => {
          const playerPreds = predictions
            .filter((p) => p.user_id === player.id)
            .sort((a, b) => {
              const matchA = matches.find((m) => m.id === a.match_id);
              const matchB = matches.find((m) => m.id === b.match_id);
              return (
                new Date(matchA?.match_date) - new Date(matchB?.match_date)
              );
            });

          let currentStreak = 0;
          let maxStreak = 0;
          playerPreds.forEach((p) => {
            if (p.points_earned === 0) {
              currentStreak++;
              maxStreak = Math.max(maxStreak, currentStreak);
            } else {
              currentStreak = 0;
            }
          });

          return { username: player.username, streak: maxStreak };
        })
        .filter((s) => s.streak > 0)
        .sort((a, b) => b.streak - a.streak)[0];

      // Score Variety - Who used the most different scores
      const scoreVariety = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const uniqueScores = new Set(
            playerPreds.map(
              (p) => `${p.predicted_home_score}-${p.predicted_away_score}`,
            ),
          );
          return { username: player.username, count: uniqueScores.size };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Favorite Score - Each player's most predicted score
      const favoriteScores = players.map((player) => {
        const playerPreds = predictions.filter((p) => p.user_id === player.id);
        const scoreCounts = {};
        playerPreds.forEach((p) => {
          const key = `${p.predicted_home_score}-${p.predicted_away_score}`;
          scoreCounts[key] = (scoreCounts[key] || 0) + 1;
        });
        const favorite = Object.entries(scoreCounts).sort(
          (a, b) => b[1] - a[1],
        )[0];
        return {
          username: player.username,
          score: favorite ? favorite[0] : null,
          count: favorite ? favorite[1] : 0,
        };
      });

      // Home Believer - Most home team wins predicted
      const homeBelievers = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const homeWins = playerPreds.filter(
            (p) => p.predicted_home_score > p.predicted_away_score,
          ).length;
          return { username: player.username, count: homeWins };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Underdog Picker - Most away team wins predicted
      const underdogPickers = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const awayWins = playerPreds.filter(
            (p) => p.predicted_away_score > p.predicted_home_score,
          ).length;
          return { username: player.username, count: awayWins };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Most Controversial Match - Widest variety of predictions
      const controversialMatches = matches
        .filter((m) => m.is_completed)
        .map((match) => {
          const matchPreds = predictions.filter((p) => p.match_id === match.id);
          const uniquePreds = new Set(
            matchPreds.map(
              (p) => `${p.predicted_home_score}-${p.predicted_away_score}`,
            ),
          );
          return { match, variety: uniquePreds.size };
        })
        .sort((a, b) => b.variety - a.variety)[0];

      // Unanimous Match - Everyone predicted same winner
      const unanimousMatches = matches
        .filter((m) => m.is_completed)
        .map((match) => {
          const matchPreds = predictions.filter((p) => p.match_id === match.id);
          if (matchPreds.length === 0) return null;

          const winners = matchPreds.map((p) =>
            p.predicted_home_score > p.predicted_away_score
              ? "home"
              : p.predicted_away_score > p.predicted_home_score
                ? "away"
                : "draw",
          );
          const uniqueWinners = new Set(winners);

          return uniqueWinners.size === 1
            ? { match, winner: winners[0] }
            : null;
        })
        .filter((m) => m !== null)[0];

      // Shock Result - Fewest correct predictions
      const shockResults = matches
        .filter((m) => m.is_completed)
        .map((match) => {
          const matchPreds = predictions.filter((p) => p.match_id === match.id);
          const correctPreds = matchPreds.filter((p) => {
            const predWinner =
              p.predicted_home_score > p.predicted_away_score
                ? "home"
                : p.predicted_away_score > p.predicted_home_score
                  ? "away"
                  : "draw";
            const actualWinner =
              match.home_score > match.away_score
                ? "home"
                : match.away_score > match.home_score
                  ? "away"
                  : "draw";
            return predWinner === actualWinner;
          }).length;
          const correctRate =
            matchPreds.length > 0
              ? (correctPreds / matchPreds.length) * 100
              : 0;
          return {
            match,
            correctRate,
            correctCount: correctPreds,
            total: matchPreds.length,
          };
        })
        .sort((a, b) => a.correctRate - b.correctRate)[0];

      // Conservative Player - Most low-scoring predictions
      const conservativePlayers = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const lowScoring = playerPreds.filter(
            (p) => p.predicted_home_score + p.predicted_away_score <= 2,
          ).length;
          return { username: player.username, count: lowScoring };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Goal Fest Believer - Most high-scoring predictions
      const goalFestBelievers = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const highScoring = playerPreds.filter(
            (p) => p.predicted_home_score + p.predicted_away_score >= 4,
          ).length;
          return { username: player.username, count: highScoring };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Risk Taker - Highest average goal difference predicted
      const riskTakers = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const avgDiff =
            playerPreds.reduce(
              (sum, p) =>
                sum + Math.abs(p.predicted_home_score - p.predicted_away_score),
              0,
            ) / (playerPreds.length || 1);
          return { username: player.username, avgDiff: avgDiff.toFixed(1) };
        })
        .sort((a, b) => parseFloat(b.avgDiff) - parseFloat(a.avgDiff))[0];

      // Clutch Performance - Best in finals/semis (round 4+)
      const clutchPlayers = players
        .map((player) => {
          const clutchPreds = predictions.filter((p) => {
            const match = matches.find((m) => m.id === p.match_id);
            return p.user_id === player.id && match && (match.round || 1) >= 4;
          });
          const clutchPoints = clutchPreds.reduce(
            (sum, p) => sum + p.points_earned,
            0,
          );
          return {
            username: player.username,
            points: clutchPoints,
            matches: clutchPreds.length,
          };
        })
        .filter((p) => p.matches > 0)
        .sort((a, b) => b.points - a.points)[0];

      // Lone Wolf - Most unique predictions (predictions no one else made)
      const loneWolves = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const uniquePreds = playerPreds.filter((pred) => {
            const samePreds = predictions.filter(
              (p) =>
                p.match_id === pred.match_id &&
                p.predicted_home_score === pred.predicted_home_score &&
                p.predicted_away_score === pred.predicted_away_score,
            );
            return samePreds.length === 1;
          }).length;
          return { username: player.username, count: uniquePreds };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Almost Perfect - Predictions that were 1 goal off from exact score
      const almostPerfect = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const almostCount = playerPreds.filter((pred) => {
            const match = matches.find(
              (m) => m.id === pred.match_id && m.is_completed,
            );
            if (!match) return false;
            const homeDiff = Math.abs(
              pred.predicted_home_score - match.home_score,
            );
            const awayDiff = Math.abs(
              pred.predicted_away_score - match.away_score,
            );
            return homeDiff + awayDiff === 1;
          }).length;
          return { username: player.username, count: almostCount };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Average error margin on goals
      const avgErrors = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const completedPreds = playerPreds.filter((p) => {
            const match = matches.find((m) => m.id === p.match_id);
            return match?.is_completed;
          });

          if (completedPreds.length === 0)
            return { username: player.username, error: 999 };

          const totalError = completedPreds.reduce((sum, pred) => {
            const match = matches.find((m) => m.id === pred.match_id);
            const homeDiff = Math.abs(
              pred.predicted_home_score - match.home_score,
            );
            const awayDiff = Math.abs(
              pred.predicted_away_score - match.away_score,
            );
            return sum + homeDiff + awayDiff;
          }, 0);

          return {
            username: player.username,
            error: (totalError / completedPreds.length).toFixed(2),
          };
        })
        .sort((a, b) => parseFloat(a.error) - parseFloat(b.error))[0];

      // Most accurate at predicting total goals
      const goalAccuracy = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const completedPreds = playerPreds.filter((p) => {
            const match = matches.find((m) => m.id === p.match_id);
            return match?.is_completed;
          });

          if (completedPreds.length === 0)
            return { username: player.username, accuracy: 0 };

          const correctTotals = completedPreds.filter((pred) => {
            const match = matches.find((m) => m.id === pred.match_id);
            const predTotal =
              pred.predicted_home_score + pred.predicted_away_score;
            const actualTotal = match.home_score + match.away_score;
            return predTotal === actualTotal;
          }).length;

          return {
            username: player.username,
            accuracy: Math.round((correctTotals / completedPreds.length) * 100),
            count: correctTotals,
          };
        })
        .sort((a, b) => b.accuracy - a.accuracy)[0];

      // Best at predicting home team scores
      const homeAccuracy = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const completedPreds = playerPreds.filter((p) => {
            const match = matches.find((m) => m.id === p.match_id);
            return match?.is_completed;
          });

          if (completedPreds.length === 0)
            return { username: player.username, accuracy: 0 };

          const correctHome = completedPreds.filter((pred) => {
            const match = matches.find((m) => m.id === pred.match_id);
            return pred.predicted_home_score === match.home_score;
          }).length;

          return {
            username: player.username,
            accuracy: Math.round((correctHome / completedPreds.length) * 100),
            count: correctHome,
          };
        })
        .sort((a, b) => b.accuracy - a.accuracy)[0];

      // Best at predicting away team scores
      const awayAccuracy = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          const completedPreds = playerPreds.filter((p) => {
            const match = matches.find((m) => m.id === p.match_id);
            return match?.is_completed;
          });

          if (completedPreds.length === 0)
            return { username: player.username, accuracy: 0 };

          const correctAway = completedPreds.filter((pred) => {
            const match = matches.find((m) => m.id === pred.match_id);
            return pred.predicted_away_score === match.away_score;
          }).length;

          return {
            username: player.username,
            accuracy: Math.round((correctAway / completedPreds.length) * 100),
            count: correctAway,
          };
        })
        .sort((a, b) => b.accuracy - a.accuracy)[0];

      // Biggest prediction error (furthest from actual)
      const biggestErrors = [];
      predictions.forEach((pred) => {
        const match = matches.find(
          (m) => m.id === pred.match_id && m.is_completed,
        );
        if (match) {
          const homeDiff = Math.abs(
            pred.predicted_home_score - match.home_score,
          );
          const awayDiff = Math.abs(
            pred.predicted_away_score - match.away_score,
          );
          const totalError = homeDiff + awayDiff;
          const player = players.find((p) => p.id === pred.user_id);
          biggestErrors.push({
            username: player?.username,
            match,
            predicted: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
            actual: `${match.home_score}-${match.away_score}`,
            error: totalError,
          });
        }
      });
      const worstPrediction = biggestErrors.sort(
        (a, b) => b.error - a.error,
      )[0];

      // Consensus Breaker - Most predictions against majority
      const consensusBreakers = players
        .map((player) => {
          const playerPreds = predictions.filter(
            (p) => p.user_id === player.id,
          );
          let againstConsensus = 0;

          playerPreds.forEach((pred) => {
            const matchPreds = predictions.filter(
              (p) => p.match_id === pred.match_id,
            );
            if (matchPreds.length < 3) return;

            const predWinner =
              pred.predicted_home_score > pred.predicted_away_score
                ? "home"
                : pred.predicted_away_score > pred.predicted_home_score
                  ? "away"
                  : "draw";

            const winners = matchPreds.map((p) =>
              p.predicted_home_score > p.predicted_away_score
                ? "home"
                : p.predicted_away_score > p.predicted_home_score
                  ? "away"
                  : "draw",
            );

            const winnerCounts = {};
            winners.forEach(
              (w) => (winnerCounts[w] = (winnerCounts[w] || 0) + 1),
            );
            const majority = Object.entries(winnerCounts).sort(
              (a, b) => b[1] - a[1],
            )[0][0];

            if (predWinner !== majority) againstConsensus++;
          });

          return { username: player.username, count: againstConsensus };
        })
        .sort((a, b) => b.count - a.count)[0];

      // Best round performance for each player
      const roundPerformances = players.map((player) => {
        const rounds = {};
        predictions
          .filter((p) => p.user_id === player.id)
          .forEach((pred) => {
            const match = matches.find((m) => m.id === pred.match_id);
            const round = match?.round || 1;
            if (!rounds[round]) rounds[round] = { points: 0, matches: 0 };
            rounds[round].points += pred.points_earned;
            rounds[round].matches += 1;
          });

        let bestRound = null;
        let bestAvg = 0;
        Object.entries(rounds).forEach(([round, data]) => {
          const avg = data.points / data.matches;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestRound = round;
          }
        });

        return {
          username: player.username,
          round: bestRound,
          avgPoints: bestAvg.toFixed(1),
          totalPoints: bestRound ? rounds[bestRound].points : 0,
        };
      });

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
        hotStreak: hotStreaks,
        coldStreak: coldStreaks,
        scoreVariety,
        favoriteScores,
        homeBeliever: homeBelievers,
        underdogPicker: underdogPickers,
        controversialMatch: controversialMatches,
        unanimousMatch: unanimousMatches,
        shockResult: shockResults,
        conservativePlayer: conservativePlayers,
        goalFestBeliever: goalFestBelievers,
        riskTaker: riskTakers,
        clutchPlayer: clutchPlayers,
        loneWolf: loneWolves,
        almostPerfect,
        avgError: avgErrors,
        goalAccuracy,
        homeAccuracy,
        awayAccuracy,
        worstPrediction,
        consensusBreaker: consensusBreakers,
        roundPerformances,
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

        {/* Hot Streak */}
        {stats.hotStreak && stats.hotStreak.streak > 1 && (
          <div className="stat-card">
            <h3>🔥 Hot Streak</h3>
            <div className="stat-detail">
              <strong>{stats.hotStreak.username}</strong> was on fire with{" "}
              <strong>{stats.hotStreak.streak}</strong> consecutive predictions
              earning points! 🔥
            </div>
          </div>
        )}

        {/* Cold Streak */}
        {stats.coldStreak && stats.coldStreak.streak > 1 && (
          <div className="stat-card">
            <h3>🥶 Cold Streak</h3>
            <div className="stat-detail">
              <strong>{stats.coldStreak.username}</strong> went through a rough
              patch with <strong>{stats.coldStreak.streak}</strong> predictions
              in a row without points 😬
            </div>
          </div>
        )}

        {/* Score Variety */}
        {stats.scoreVariety && (
          <div className="stat-card">
            <h3>🎲 Most Creative</h3>
            <div className="stat-detail">
              <strong>{stats.scoreVariety.username}</strong> used{" "}
              <strong>{stats.scoreVariety.count}</strong> different score
              predictions! The most diverse predictions 🌈
            </div>
          </div>
        )}

        {/* Home Believer */}
        {stats.homeBeliever && (
          <div className="stat-card">
            <h3>🏠 Home Advantage Believer</h3>
            <div className="stat-detail">
              <strong>{stats.homeBeliever.username}</strong> backed the home
              team <strong>{stats.homeBeliever.count}</strong> times! 🏠
            </div>
          </div>
        )}

        {/* Underdog Picker */}
        {stats.underdogPicker && (
          <div className="stat-card">
            <h3>🛫 Underdog Specialist</h3>
            <div className="stat-detail">
              <strong>{stats.underdogPicker.username}</strong> predicted away
              wins <strong>{stats.underdogPicker.count}</strong> times! Always
              backing the underdogs 💪
            </div>
          </div>
        )}

        {/* Controversial Match */}
        {stats.controversialMatch && stats.controversialMatch.variety > 3 && (
          <div className="stat-card">
            <h3>🎪 Most Controversial Match</h3>
            <div className="match-display">
              <div className="teams">
                {stats.controversialMatch.match.home_team.flag_emoji}{" "}
                {stats.controversialMatch.match.home_team.name}
                <strong className="score">
                  {" "}
                  {stats.controversialMatch.match.home_score} -{" "}
                  {stats.controversialMatch.match.away_score}{" "}
                </strong>
                {stats.controversialMatch.match.away_team.flag_emoji}{" "}
                {stats.controversialMatch.match.away_team.name}
              </div>
              <div className="total-goals">
                {stats.controversialMatch.variety} different predictions! Nobody
                could agree 🤯
              </div>
            </div>
          </div>
        )}

        {/* Unanimous Match */}
        {stats.unanimousMatch && (
          <div className="stat-card">
            <h3>🤝 Most Predictable Match</h3>
            <div className="match-display">
              <div className="teams">
                {stats.unanimousMatch.match.home_team.flag_emoji}{" "}
                {stats.unanimousMatch.match.home_team.name}
                <strong className="score">
                  {" "}
                  {stats.unanimousMatch.match.home_score} -{" "}
                  {stats.unanimousMatch.match.away_score}{" "}
                </strong>
                {stats.unanimousMatch.match.away_team.flag_emoji}{" "}
                {stats.unanimousMatch.match.away_team.name}
              </div>
              <div className="total-goals">
                Everyone predicted the same winner! 100% agreement 🎯
              </div>
            </div>
          </div>
        )}

        {/* Shock Result */}
        {stats.shockResult && stats.shockResult.correctRate < 50 && (
          <div className="stat-card">
            <h3>⚡ Biggest Shock</h3>
            <div className="match-display">
              <div className="teams">
                {stats.shockResult.match.home_team.flag_emoji}{" "}
                {stats.shockResult.match.home_team.name}
                <strong className="score">
                  {" "}
                  {stats.shockResult.match.home_score} -{" "}
                  {stats.shockResult.match.away_score}{" "}
                </strong>
                {stats.shockResult.match.away_team.flag_emoji}{" "}
                {stats.shockResult.match.away_team.name}
              </div>
              <div className="total-goals">
                Only {stats.shockResult.correctCount} out of{" "}
                {stats.shockResult.total} predicted the winner! (
                {Math.round(stats.shockResult.correctRate)}%) 😱
              </div>
            </div>
          </div>
        )}

        {/* Conservative Player */}
        {stats.conservativePlayer && stats.conservativePlayer.count > 0 && (
          <div className="stat-card">
            <h3>🤔 Most Conservative</h3>
            <div className="stat-detail">
              <strong>{stats.conservativePlayer.username}</strong> predicted
              low-scoring games{" "}
              <strong>{stats.conservativePlayer.count}</strong> times (≤2 goals
              total) 🛡️
            </div>
          </div>
        )}

        {/* Goal Fest Believer */}
        {stats.goalFestBeliever && stats.goalFestBeliever.count > 0 && (
          <div className="stat-card">
            <h3>💥 Goal Fest Believer</h3>
            <div className="stat-detail">
              <strong>{stats.goalFestBeliever.username}</strong> loves action!
              Predicted <strong>{stats.goalFestBeliever.count}</strong>{" "}
              high-scoring games (≥4 goals) ⚽⚽⚽
            </div>
          </div>
        )}

        {/* Risk Taker */}
        {stats.riskTaker && (
          <div className="stat-card">
            <h3>🎰 Biggest Risk Taker</h3>
            <div className="stat-detail">
              <strong>{stats.riskTaker.username}</strong> predicted the biggest
              margins on average: <strong>{stats.riskTaker.avgDiff}</strong>{" "}
              goal difference! Bold predictions 💪
            </div>
          </div>
        )}

        {/* Clutch Player */}
        {stats.clutchPlayer && stats.clutchPlayer.points > 0 && (
          <div className="stat-card">
            <h3>⭐ Clutch Performance</h3>
            <div className="stat-detail">
              <strong>{stats.clutchPlayer.username}</strong> saved the best for
              last! <strong>{stats.clutchPlayer.points}</strong> points in the
              knockout rounds ({stats.clutchPlayer.matches} matches) 🏆
            </div>
          </div>
        )}

        {/* Favorite Scores */}
        {stats.favoriteScores && stats.favoriteScores.length > 0 && (
          <div className="stat-card">
            <h3>💯 Everyone's Favorite Predictions</h3>
            <div className="stat-list">
              {stats.favoriteScores.slice(0, 5).map(
                (player, idx) =>
                  player.score && (
                    <div key={idx} className="stat-item">
                      <span className="label">{player.username}:</span>
                      <span className="value">
                        {player.score} ({player.count}x)
                      </span>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}

        {/* Lone Wolf */}
        {stats.loneWolf && stats.loneWolf.count > 0 && (
          <div className="stat-card">
            <h3>🐺 Lone Wolf</h3>
            <div className="stat-detail">
              <strong>{stats.loneWolf.username}</strong> made{" "}
              <strong>{stats.loneWolf.count}</strong> unique predictions that no
              one else made! Independent thinker 🎯
            </div>
          </div>
        )}

        {/* Almost Perfect */}
        {stats.almostPerfect && stats.almostPerfect.count > 0 && (
          <div className="stat-card">
            <h3>😩 So Close!</h3>
            <div className="stat-detail">
              <strong>{stats.almostPerfect.username}</strong> was just 1 goal
              off from perfect <strong>{stats.almostPerfect.count}</strong>{" "}
              times! The agony! 😭
            </div>
          </div>
        )}

        {/* Most Accurate Overall */}
        {stats.avgError && stats.avgError.error < 999 && (
          <div className="stat-card">
            <h3>🎯 Most Accurate Overall</h3>
            <div className="stat-detail">
              <strong>{stats.avgError.username}</strong> had the lowest average
              error: <strong>{stats.avgError.error}</strong> goals per match!
              Precision master 📐
            </div>
          </div>
        )}

        {/* Goal Total Accuracy */}
        {stats.goalAccuracy && stats.goalAccuracy.accuracy > 0 && (
          <div className="stat-card">
            <h3>🔢 Total Goals Prophet</h3>
            <div className="stat-detail">
              <strong>{stats.goalAccuracy.username}</strong> predicted the
              correct total goals{" "}
              <strong>{stats.goalAccuracy.accuracy}%</strong> of the time (
              {stats.goalAccuracy.count} matches)! 🎰
            </div>
          </div>
        )}

        {/* Home Score Expert */}
        {stats.homeAccuracy && stats.homeAccuracy.accuracy > 0 && (
          <div className="stat-card">
            <h3>🏠 Home Score Expert</h3>
            <div className="stat-detail">
              <strong>{stats.homeAccuracy.username}</strong> nailed the home
              team score <strong>{stats.homeAccuracy.accuracy}%</strong> of the
              time ({stats.homeAccuracy.count} matches)! 🎯
            </div>
          </div>
        )}

        {/* Away Score Expert */}
        {stats.awayAccuracy && stats.awayAccuracy.accuracy > 0 && (
          <div className="stat-card">
            <h3>✈️ Away Score Expert</h3>
            <div className="stat-detail">
              <strong>{stats.awayAccuracy.username}</strong> predicted away
              scores perfectly <strong>{stats.awayAccuracy.accuracy}%</strong>{" "}
              of the time ({stats.awayAccuracy.count} matches)! 🛫
            </div>
          </div>
        )}

        {/* Worst Prediction */}
        {stats.worstPrediction && stats.worstPrediction.error > 3 && (
          <div className="stat-card">
            <h3>😅 Wildest Prediction</h3>
            <div className="match-display">
              <div className="teams">
                {stats.worstPrediction.match.home_team.flag_emoji}{" "}
                {stats.worstPrediction.match.home_team.name} vs{" "}
                {stats.worstPrediction.match.away_team.flag_emoji}{" "}
                {stats.worstPrediction.match.away_team.name}
              </div>
              <div className="stat-detail" style={{ marginTop: "0.5rem" }}>
                <strong>{stats.worstPrediction.username}</strong> predicted{" "}
                <strong>{stats.worstPrediction.predicted}</strong> but it ended{" "}
                <strong>{stats.worstPrediction.actual}</strong>! Off by{" "}
                {stats.worstPrediction.error} goals 🤯
              </div>
            </div>
          </div>
        )}

        {/* Consensus Breaker */}
        {stats.consensusBreaker && stats.consensusBreaker.count > 0 && (
          <div className="stat-card">
            <h3>🤘 Rebel</h3>
            <div className="stat-detail">
              <strong>{stats.consensusBreaker.username}</strong> went against
              the majority <strong>{stats.consensusBreaker.count}</strong>{" "}
              times! Not afraid to go their own way 💪
            </div>
          </div>
        )}

        {/* Best Round Performances */}
        {stats.roundPerformances && stats.roundPerformances.length > 0 && (
          <div className="stat-card">
            <h3>📈 Best Round for Each Player</h3>
            <div className="stat-list">
              {stats.roundPerformances.slice(0, 5).map(
                (perf, idx) =>
                  perf.round && (
                    <div key={idx} className="stat-item">
                      <span className="label">{perf.username}:</span>
                      <span className="value">
                        Round {perf.round} ({perf.avgPoints} avg,{" "}
                        {perf.totalPoints} pts)
                      </span>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
