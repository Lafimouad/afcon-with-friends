import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function FinalReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    try {
      // Get final standings
      const { data: players, error: playersError } = await supabase
        .from("profiles")
        .select("*")
        .order("total_points", { ascending: false });

      if (playersError) throw playersError;

      // Get all completed matches
      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select(
          `
          *,
          home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
          away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
        `,
        )
        .eq("is_completed", true)
        .order("match_date", { ascending: false })
        .order("id", { ascending: true });

      if (matchError) throw matchError;

      // Get all predictions with points
      const { data: predictions, error: predError } = await supabase
        .from("predictions")
        .select(
          `
          *,
          user:profiles(username),
          match:matches(*)
        `,
        )
        .order("points_earned", { ascending: false });

      if (predError) throw predError;

      // Calculate additional stats
      const totalPoints = players.reduce((sum, p) => sum + p.total_points, 0);
      const avgPoints = Math.round(totalPoints / players.length);

      // Get each player's best performance
      const playerBestMatches = players.map((player) => {
        const playerPreds = predictions.filter((p) => p.user_id === player.id);
        const bestPred = playerPreds.sort(
          (a, b) => b.points_earned - a.points_earned,
        )[0];

        // Count perfect predictions by comparing predicted vs actual scores
        const perfectCount = playerPreds.filter((pred) => {
          const match = matches.find((m) => m.id === pred.match_id);
          return (
            match &&
            pred.predicted_home_score === match.home_score &&
            pred.predicted_away_score === match.away_score
          );
        }).length;

        return {
          player: player.username,
          bestPoints: bestPred?.points_earned || 0,
          perfectPredictions: perfectCount,
        };
      });

      setReport({
        finalStandings: players,
        recentMatches: matches.slice(0, 5),
        totalMatches: matches.length,
        avgPoints,
        winner: players[0],
        runnerUp: players[1],
        thirdPlace: players[2],
        playerBestMatches,
        generatedAt: new Date().toLocaleString(),
      });
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const reportText = `
  WORLD CUP 2026 PREDICTION GAME - FINAL REPORT
Generated: ${report.generatedAt}
==========================================

🏆 TOURNAMENT CHAMPION 🏆
${report.winner.username} - ${report.winner.total_points} points

FINAL STANDINGS
===============
${report.finalStandings
  .map(
    (p, idx) =>
      `${idx + 1}. ${idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "  "} ${p.username} - ${p.total_points} points`,
  )
  .join("\n")}

STATISTICS
==========
Total Matches: ${report.totalMatches}
Average Score: ${report.avgPoints} points
Point Spread: ${report.winner.total_points - report.finalStandings[report.finalStandings.length - 1].total_points}

PLAYER HIGHLIGHTS
=================
${report.playerBestMatches
  .map(
    (p) =>
      `${p.player}: ${p.perfectPredictions} perfect predictions, best match: ${p.bestPoints} points`,
  )
  .join("\n")}

RECENT MATCHES
==============
${report.recentMatches
  .map(
    (m) =>
      `${m.home_team.flag_emoji} ${m.home_team.name} ${m.home_score} - ${m.away_score} ${m.away_team.name} ${m.away_team.flag_emoji}`,
  )
  .join("\n")}

Thank you for participating in World Cup 2026 Predictions!
    `.trim();

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "World-Cup-2026-Final-Report.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading">Generating final report...</div>;
  }

  if (!report) {
    return <div className="error">Failed to generate report</div>;
  }

  return (
    <div className="final-report">
      <div className="report-header">
        <h2>📋 World Cup 2026 - Final Report</h2>
        <button className="btn-download" onClick={downloadReport}>
          📥 Download Report
        </button>
      </div>

      <div className="report-content">
        {/* Champion Section */}
        <section className="report-section champion-section">
          <h3>🏆 Tournament Champion</h3>
          <div className="champion-card">
            <div className="trophy">👑</div>
            <div className="champion-info">
              <div className="champion-name">{report.winner.username}</div>
              <div className="champion-points">
                {report.winner.total_points} points
              </div>
              <div className="champion-subtitle">
                World Cup 2026 Prediction Winner
              </div>
            </div>
          </div>
        </section>

        {/* Podium */}
        <section className="report-section">
          <h3>🏅 Top 3 Finishers</h3>
          <div className="podium">
            <div className="podium-place second">
              <div className="medal">🥈</div>
              <div className="position">2nd</div>
              <div className="player-name">{report.runnerUp?.username}</div>
              <div className="player-points">
                {report.runnerUp?.total_points} pts
              </div>
            </div>
            <div className="podium-place first">
              <div className="medal">🥇</div>
              <div className="position">1st</div>
              <div className="player-name">{report.winner.username}</div>
              <div className="player-points">
                {report.winner.total_points} pts
              </div>
            </div>
            <div className="podium-place third">
              <div className="medal">🥉</div>
              <div className="position">3rd</div>
              <div className="player-name">{report.thirdPlace?.username}</div>
              <div className="player-points">
                {report.thirdPlace?.total_points} pts
              </div>
            </div>
          </div>
        </section>

        {/* Final Standings */}
        <section className="report-section">
          <h3>📊 Complete Final Standings</h3>
          <div className="standings-table">
            {report.finalStandings.map((player, idx) => (
              <div
                key={player.id}
                className={`standing-row ${idx < 3 ? "top-three" : ""}`}
              >
                <span className="rank">
                  {idx === 0 && "🥇"}
                  {idx === 1 && "🥈"}
                  {idx === 2 && "🥉"}
                  {idx > 2 && `${idx + 1}.`}
                </span>
                <span className="player">{player.username}</span>
                <span className="points">{player.total_points} pts</span>
              </div>
            ))}
          </div>
        </section>

        {/* Player Highlights */}
        <section className="report-section">
          <h3>⭐ Player Highlights</h3>
          <div className="highlights-grid">
            {report.playerBestMatches.map((playerStat, idx) => (
              <div key={idx} className="highlight-card">
                <div className="highlight-player">{playerStat.player}</div>
                <div className="highlight-stats">
                  <div className="stat">
                    <span className="stat-label">Perfect Predictions:</span>
                    <span className="stat-value">
                      {playerStat.perfectPredictions}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Best Match:</span>
                    <span className="stat-value">
                      {playerStat.bestPoints} pts
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tournament Summary */}
        <section className="report-section">
          <h3>📈 Tournament Summary</h3>
          <div className="summary-stats">
            <div className="summary-item">
              <div className="summary-label">Total Matches Played</div>
              <div className="summary-value">{report.totalMatches}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Average Score</div>
              <div className="summary-value">{report.avgPoints} pts</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total Participants</div>
              <div className="summary-value">
                {report.finalStandings.length}
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Point Spread</div>
              <div className="summary-value">
                {report.winner.total_points -
                  report.finalStandings[report.finalStandings.length - 1]
                    .total_points}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="report-footer">
          <p>Thank you for participating in World Cup 2026 Predictions! 🎉</p>
          <p className="generated-at">
            Report generated on {report.generatedAt}
          </p>
        </div>
      </div>
    </div>
  );
}
