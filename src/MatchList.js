import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

export default function MatchList({ onSelectMatch, onViewPredictions }) {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState(null);
  const [availableRounds, setAvailableRounds] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    loadMatches();
  }, [user]);

  const loadMatches = async () => {
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select(
          `
          *,
          home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
          away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
        `
        )
        .order("round", { ascending: true })
        .order("match_date", { ascending: true });

      if (matchesError) throw matchesError;

      const { data: predictionsData } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id);

      const predMap = {};
      predictionsData?.forEach((pred) => {
        predMap[pred.match_id] = pred;
      });

      // Get unique rounds
      const allRounds = [
        ...new Set(matchesData?.map((m) => m.round || 1) || []),
      ].sort();

      setAvailableRounds(allRounds);

      // Auto-select the current/next round (first incomplete round that's unlocked)
      let currentRound = allRounds[0];
      for (const round of allRounds) {
        const isUnlocked =
          round === 1 ||
          (() => {
            const prevRound = round - 1;
            const prevRoundMatches = matchesData.filter(
              (m) => (m.round || 1) === prevRound
            );
            return (
              prevRoundMatches.length > 0 &&
              prevRoundMatches.every((m) => m.is_completed)
            );
          })();

        if (isUnlocked) {
          const roundMatches = matchesData.filter(
            (m) => (m.round || 1) === round
          );
          if (
            roundMatches.some(
              (m) => !m.is_completed || new Date(m.match_date) > new Date()
            )
          ) {
            currentRound = round;
            break;
          }
          currentRound = round; // If all completed, still select this round
        }
      }

      setSelectedRound(currentRound);
      setMatches(matchesData || []);
      setPredictions(predMap);
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canPredict = (match) => {
    return new Date(match.match_date) > new Date() && !match.is_completed;
  };

  const hasMatchStarted = (match) => {
    return new Date(match.match_date) <= new Date();
  };

  const formatStageLabel = (match) => {
    if (match.group_name) {
      return `Group ${match.group_name}`;
    }

    if (match.stage === "group_stage") {
      return `Round ${match.round || 1}`;
    }

    const stageLabels = {
      round_of_32: "Round of 32",
      round_of_16: "Round of 16",
      quarter_final: "Quarter-final",
      semi_final: "Semi-final",
      third_place: "Third place",
      final: "Final",
    };

    return stageLabels[match.stage] || "Match";
  };

  // Check if a round is unlocked (previous round completed)
  const isRoundUnlocked = (round) => {
    if (round === 1) return true;
    const prevRound = round - 1;
    const prevRoundMatches = matches.filter(
      (m) => (m.round || 1) === prevRound
    );
    return (
      prevRoundMatches.length > 0 &&
      prevRoundMatches.every((m) => m.is_completed)
    );
  };

  // Filter matches by selected round
  const roundMatches = matches.filter((m) => (m.round || 1) === selectedRound);

  if (loading) {
    return <div className="loading">Loading matches...</div>;
  }

  return (
    <div className="match-list">
      <div className="round-header">
        <h2>Matches</h2>
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
      {roundMatches.length === 0 ? (
        <p>No matches available for this round.</p>
      ) : (
        <div className="matches-grid">
          {roundMatches.map((match) => {
            const prediction = predictions[match.id];
            const isPredictable = canPredict(match);

            return (
              <div key={match.id} className="match-card">
                {" "}
                <div className="match-header">
                  <span className="match-stage">{formatStageLabel(match)}</span>
                  <span className="match-date">
                    {formatDate(match.match_date)}
                  </span>
                </div>
                <div className="match-teams">
                  <div className="team">
                    <span className="team-flag">
                      {match.home_team.flag_emoji}
                    </span>
                    <span className="team-name">{match.home_team.name}</span>
                  </div>

                  <div className="match-score">
                    {match.is_completed ? (
                      <div className="final-score">
                        <span className="score">{match.home_score}</span>
                        <span className="vs">-</span>
                        <span className="score">{match.away_score}</span>
                      </div>
                    ) : prediction ? (
                      <div className="predicted-score">
                        <span className="score">
                          {prediction.predicted_home_score}
                        </span>
                        <span className="vs">-</span>
                        <span className="score">
                          {prediction.predicted_away_score}
                        </span>
                      </div>
                    ) : (
                      <div className="no-prediction">
                        <span className="vs">VS</span>
                      </div>
                    )}
                  </div>

                  <div className="team">
                    <span className="team-flag">
                      {match.away_team.flag_emoji}
                    </span>
                    <span className="team-name">{match.away_team.name}</span>
                  </div>
                </div>
                <div className="match-footer">
                  {match.is_completed ? (
                    <div className="match-status">
                      <span className="status-badge completed">Completed</span>
                      {prediction && (
                        <span className="points-earned">
                          {prediction.points_earned} pts
                        </span>
                      )}
                      <button
                        className="btn-secondary btn-small"
                        onClick={() => onViewPredictions(match)}
                      >
                        View All Predictions
                      </button>
                    </div>
                  ) : prediction ? (
                    <div className="match-status">
                      <span className="status-badge predicted">Predicted</span>
                      {isPredictable && (
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => onSelectMatch(match, prediction)}
                        >
                          Edit
                        </button>
                      )}
                      {hasMatchStarted(match) && (
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => onViewPredictions(match)}
                        >
                          View All
                        </button>
                      )}
                    </div>
                  ) : isPredictable ? (
                    <button
                      className="btn-primary btn-small"
                      onClick={() => onSelectMatch(match, null)}
                    >
                      Make Prediction
                    </button>
                  ) : (
                    <div className="match-status">
                      <span className="status-badge locked">Locked</span>
                      {hasMatchStarted(match) && (
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => onViewPredictions(match)}
                        >
                          View All
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
