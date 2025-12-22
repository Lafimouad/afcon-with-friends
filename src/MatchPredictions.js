import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

export default function MatchPredictions({ match, onClose }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadPredictions();
  }, [match.id]);

  const loadPredictions = async () => {
    try {
      const { data, error } = await supabase
        .from("predictions")
        .select(
          `
          *,
          profiles:user_id (username)
        `
        )
        .eq("match_id", match.id)
        .order("predicted_home_score", { ascending: false });

      if (error) throw error;

      setPredictions(data || []);
    } catch (error) {
      console.error("Error loading predictions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasMatchStarted = () => {
    return new Date(match.match_date) <= new Date();
  };

  if (!hasMatchStarted()) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Predictions Hidden</h2>
            <button className="btn-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-body">
            <p className="info-message">
              Predictions will be visible once the match starts.
            </p>
            <p className="match-start-time">
              Match starts: {new Date(match.match_date).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content predictions-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Everyone's Predictions</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="match-info-header">
            <div className="team-vs">
              <span className="team-flag">{match.home_team.flag_emoji}</span>
              <span className="team-name">{match.home_team.name}</span>
              <span className="vs-text">VS</span>
              <span className="team-flag">{match.away_team.flag_emoji}</span>
              <span className="team-name">{match.away_team.name}</span>
            </div>
            {match.is_completed && (
              <div className="final-result">
                <strong>Final Score:</strong> {match.home_score} -{" "}
                {match.away_score}
              </div>
            )}
          </div>

          {loading ? (
            <div className="loading">Loading predictions...</div>
          ) : predictions.length === 0 ? (
            <p className="no-predictions">
              No predictions made for this match yet.
            </p>
          ) : (
            <div className="predictions-list">
              {predictions.map((pred) => {
                const isCurrentUser = pred.user_id === user.id;
                const isCorrect =
                  match.is_completed &&
                  pred.predicted_home_score === match.home_score &&
                  pred.predicted_away_score === match.away_score;

                return (
                  <div
                    key={pred.id}
                    className={`prediction-item ${
                      isCurrentUser ? "current-user" : ""
                    } ${isCorrect ? "correct" : ""}`}
                  >
                    <div className="prediction-user">
                      <span className="username">
                        {pred.profiles.username}
                        {isCurrentUser && (
                          <span className="you-badge">You</span>
                        )}
                      </span>
                    </div>
                    <div className="prediction-score">
                      <span className="score-display">
                        {pred.predicted_home_score} -{" "}
                        {pred.predicted_away_score}
                      </span>
                      {isCorrect && (
                        <span className="correct-badge">✓ Exact!</span>
                      )}
                    </div>
                    {match.is_completed && (
                      <div className="prediction-points">
                        <span className="points">{pred.points_earned} pts</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
