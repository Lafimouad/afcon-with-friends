import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export default function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const [{ data: profiles, error: profilesError }, { data: exactPreds, error: exactError }] =
        await Promise.all([
          supabase.from('profiles').select('*'),
          supabase
            .from('predictions')
            .select('user_id')
            .eq('points_earned', 5),
        ]);

      if (profilesError) throw profilesError;
      if (exactError) throw exactError;

      // Count exact scores per user
      const exactCounts = {};
      for (const p of exactPreds || []) {
        exactCounts[p.user_id] = (exactCounts[p.user_id] || 0) + 1;
      }

      const ranked = (profiles || [])
        .map((p) => ({ ...p, exact_score_count: exactCounts[p.id] || 0 }))
        .sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points;
          return b.exact_score_count - a.exact_score_count;
        });

      setPlayers(ranked);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading leaderboard...</div>;
  }

  return (
    <div className="leaderboard">
      <h2>Leaderboard</h2>
      {players.length === 0 ? (
        <p>No players yet. Be the first to make predictions!</p>
      ) : (
        <div className="leaderboard-table">
          <div className="leaderboard-header">
            <span className="rank-col">Rank</span>
            <span className="player-col">Player</span>
            <span className="points-col">Points</span>
            <span className="exact-col">Exact</span>
          </div>
          {players.map((player, index) => (
            <div
              key={player.id}
              className={`leaderboard-row ${
                player.id === user.id ? 'current-user' : ''
              } ${index < 3 ? `rank-${index + 1}` : ''}`}
            >
              <span className="rank-col">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && `#${index + 1}`}
              </span>
              <span className="player-col">
                {player.username}
                {player.id === user.id && <span className="you-badge">You</span>}
              </span>
              <span className="points-col">{player.total_points}</span>
              <span className="exact-col" title="Exact score predictions">🎯 {player.exact_score_count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
