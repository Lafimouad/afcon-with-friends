import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { calculatePoints } from "./pointsCalculator";

export default function AdminPanel() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRound, setSelectedRound] = useState(null);
  const [availableRounds, setAvailableRounds] = useState([]);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
          away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
        `
        )
        .eq("is_completed", false)
        .order("round", { ascending: true })
        .order("match_date", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;

      // Get all rounds (including completed matches) to check progression
      const { data: allMatchesData } = await supabase
        .from("matches")
        .select("round, is_completed")
        .order("round", { ascending: true });

      const allRounds = [
        ...new Set(allMatchesData?.map((m) => m.round || 1) || []),
      ].sort();

      setAvailableRounds(allRounds);

      // Auto-select the first unlocked round with incomplete matches
      let currentRound = allRounds[0];
      for (const round of allRounds) {
        const isUnlocked =
          round === 1 ||
          (() => {
            const prevRound = round - 1;
            const prevRoundMatches = allMatchesData.filter(
              (m) => (m.round || 1) === prevRound
            );
            return (
              prevRoundMatches.length > 0 &&
              prevRoundMatches.every((m) => m.is_completed)
            );
          })();

        if (isUnlocked) {
          const roundMatches = data.filter((m) => (m.round || 1) === round);
          if (roundMatches.some((m) => !m.is_completed)) {
            currentRound = round;
            break;
          }
        }
      }

      setSelectedRound(currentRound);
      setMatches(data || []);
    } catch (err) {
      console.error("Error loading matches:", err);
    }
  };

  const handleSubmitResult = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Update match result
      const { error: updateError } = await supabase
        .from("matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          is_completed: true,
        })
        .eq("id", selectedMatch.id);

      if (updateError) throw updateError;

      // Fetch all predictions for this match
      const { data: predictions, error: predError } = await supabase
        .from("predictions")
        .select("*")
        .eq("match_id", selectedMatch.id);

      if (predError) throw predError;

      // Process each prediction
      const updatePromises = [];
      for (const prediction of predictions || []) {
        const points = calculatePoints(
          prediction.predicted_home_score,
          prediction.predicted_away_score,
          homeScore,
          awayScore
        );

        // Update prediction points
        updatePromises.push(
          supabase
            .from("predictions")
            .update({ points_earned: points })
            .eq("id", prediction.id)
            .then(async () => {
              // Update user's total points
              const { data: profile, error: profileFetchError } = await supabase
                .from("profiles")
                .select("total_points")
                .eq("id", prediction.user_id)
                .maybeSingle();

              if (profileFetchError) throw profileFetchError;

              if (profile) {
                const { error: profileUpdateError } = await supabase
                  .from("profiles")
                  .update({ total_points: profile.total_points + points })
                  .eq("id", prediction.user_id);

                if (profileUpdateError) throw profileUpdateError;
              }
            })
        );
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Reset form and reload matches
      setSelectedMatch(null);
      setHomeScore(0);
      setAwayScore(0);
      await loadMatches();
    } catch (err) {
      setError(`Failed to save result: ${err.message}`);
      console.error("Error saving match result:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check if a round is unlocked (previous round completed)
  const isRoundUnlocked = (round) => {
    if (round === 1) return true;
    const prevRound = round - 1;
    const prevRoundMatches = matches.filter(
      (m) => (m.round || 1) === prevRound
    );
    // For admin, also check all matches from DB
    return (
      prevRoundMatches.length === 0 ||
      prevRoundMatches.every((m) => m.is_completed)
    );
  };

  // Filter matches by selected round
  const roundMatches = matches.filter((m) => (m.round || 1) === selectedRound);

  return (
    <div className="admin-panel">
      <div className="round-header">
        <h2>Admin Panel - Enter Match Results</h2>
        {availableRounds.length > 1 && (
          <div className="round-selector">
            {availableRounds.map((round) => {
              const unlocked = isRoundUnlocked(round);
              return (
                <button
                  key={round}
                  className={`round-btn ${
                    selectedRound === round ? "active" : ""
                  } ${!unlocked ? "disabled" : ""}`}
                  onClick={() => unlocked && setSelectedRound(round)}
                  disabled={!unlocked}
                  title={!unlocked ? "Complete previous round to unlock" : ""}
                >
                  Round {round} {!unlocked && "🔒"}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedMatch ? (
        <div className="result-form-container">
          <div className="match-info">
            <div className="team-info">
              <span className="team-flag">
                {selectedMatch.home_team.flag_emoji}
              </span>
              <span className="team-name">{selectedMatch.home_team.name}</span>
            </div>
            <span className="vs-text">VS</span>
            <div className="team-info">
              <span className="team-flag">
                {selectedMatch.away_team.flag_emoji}
              </span>
              <span className="team-name">{selectedMatch.away_team.name}</span>
            </div>
          </div>

          <form onSubmit={handleSubmitResult}>
            <div className="score-inputs">
              <div className="score-input-group">
                <label>{selectedMatch.home_team.name}</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={homeScore}
                  onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="score-separator">-</div>

              <div className="score-input-group">
                <label>{selectedMatch.away_team.name}</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={awayScore}
                  onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSelectedMatch(null);
                  setHomeScore(0);
                  setAwayScore(0);
                  setError("");
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Saving..." : "Save Result"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="matches-list">
          {roundMatches.length === 0 ? (
            <p>No pending matches to enter results for this round.</p>
          ) : (
            roundMatches.map((match) => (
              <div key={match.id} className="admin-match-card">
                <div className="match-teams">
                  <span>
                    {match.home_team.flag_emoji} {match.home_team.name}
                  </span>
                  <span className="vs">VS</span>
                  <span>
                    {match.away_team.flag_emoji} {match.away_team.name}
                  </span>
                </div>
                <button
                  className="btn-primary btn-small"
                  onClick={() => setSelectedMatch(match)}
                >
                  Enter Result
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
