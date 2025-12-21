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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('total_points', { ascending: false });

      if (error) throw error;

      setPlayers(data || []);
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
