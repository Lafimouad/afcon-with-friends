import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export default function PredictionForm({ match, existingPrediction, onClose, onSaved }) {
  const [homeScore, setHomeScore] = useState(existingPrediction?.predicted_home_score || 0);
  const [awayScore, setAwayScore] = useState(existingPrediction?.predicted_away_score || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (existingPrediction) {
        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            predicted_home_score: homeScore,
            predicted_away_score: awayScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPrediction.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('predictions')
          .insert([
            {
              user_id: user.id,
              match_id: match.id,
              predicted_home_score: homeScore,
              predicted_away_score: awayScore,
            },
          ]);

        if (insertError) throw insertError;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {existingPrediction ? 'Edit Prediction' : 'Make Prediction'}
          </h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="prediction-match-info">
            <div className="team-info">
              <span className="team-flag">{match.home_team.flag_emoji}</span>
              <span className="team-name">{match.home_team.name}</span>
            </div>
            <span className="vs-text">VS</span>
            <div className="team-info">
              <span className="team-flag">{match.away_team.flag_emoji}</span>
              <span className="team-name">{match.away_team.name}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="score-inputs">
              <div className="score-input-group">
                <label>{match.home_team.name}</label>
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
                <label>{match.away_team.name}</label>
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
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Prediction'}
              </button>
            </div>
          </form>

          <div className="points-info">
            <h4>Points System:</h4>
            <ul>
              <li>Exact score: 5 points</li>
              <li>Correct winner + goal difference: 2 points</li>
              <li>Correct winner only: 1 point</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
