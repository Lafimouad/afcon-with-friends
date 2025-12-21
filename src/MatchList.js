import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export default function MatchList({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadMatches();
  }, [user]);

  const loadMatches = async () => {
    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
          away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
        `)
        .order('match_date', { ascending: true });

      if (matchesError) throw matchesError;

      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id);

      const predMap = {};
      predictionsData?.forEach((pred) => {
        predMap[pred.match_id] = pred;
      });

      setMatches(matchesData || []);
      setPredictions(predMap);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canPredict = (match) => {
    return new Date(match.match_date) > new Date() && !match.is_completed;
  };

  if (loading) {
    return <div className="loading">Loading matches...</div>;
  }

  return (
    <div className="match-list">
      <h2>Matches</h2>
      {matches.length === 0 ? (
        <p>No matches available yet.</p>
      ) : (
        <div className="matches-grid">
          {matches.map((match) => {
            const prediction = predictions[match.id];
            const isPredictable = canPredict(match);

            return (
              <div key={match.id} className="match-card">
                <div className="match-header">
                  <span className="match-stage">{match.group_name || match.stage}</span>
                  <span className="match-date">{formatDate(match.match_date)}</span>
                </div>

                <div className="match-teams">
                  <div className="team">
                    <span className="team-flag">{match.home_team.flag_emoji}</span>
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
                        <span className="score">{prediction.predicted_home_score}</span>
                        <span className="vs">-</span>
                        <span className="score">{prediction.predicted_away_score}</span>
                      </div>
                    ) : (
                      <div className="no-prediction">
                        <span className="vs">VS</span>
                      </div>
                    )}
                  </div>

                  <div className="team">
                    <span className="team-flag">{match.away_team.flag_emoji}</span>
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
                    </div>
                  ) : isPredictable ? (
                    <button
                      className="btn-primary btn-small"
                      onClick={() => onSelectMatch(match, null)}
                    >
                      Make Prediction
                    </button>
                  ) : (
                    <span className="status-badge locked">Locked</span>
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
