/*
  # World Cup 2026 Prediction Game Schema

  ## New Tables

  ### `teams`
  - `id` (uuid, primary key) - Unique team identifier
  - `name` (text) - Team name (e.g., "Argentina", "France")
  - `flag_emoji` (text) - Flag emoji for display
  - `code` (text) - 3-letter country code
  - `created_at` (timestamptz) - Record creation timestamp

  ### `matches`
  - `id` (uuid, primary key) - Unique match identifier
  - `home_team_id` (uuid, foreign key) - Reference to home team
  - `away_team_id` (uuid, foreign key) - Reference to away team
  - `match_date` (timestamptz) - When the match will be played
  - `round` (integer) - Numeric round progression used by the app UI
  - `stage` (text) - Tournament stage (group_stage, round_of_32, round_of_16, quarter_final, semi_final, third_place, final)
  - `group_name` (text, nullable) - Group identifier for group stage matches
  - `home_score` (integer, nullable) - Final home team score (null until match completed)
  - `away_score` (integer, nullable) - Final away team score (null until match completed)
  - `is_completed` (boolean) - Whether the match has finished
  - `created_at` (timestamptz) - Record creation timestamp

  ### `profiles`
  - `id` (uuid, primary key) - Links to auth.users
  - `username` (text, unique) - Display name
  - `total_points` (integer) - Accumulated points across all predictions
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `predictions`
  - `id` (uuid, primary key) - Unique prediction identifier
  - `user_id` (uuid, foreign key) - Reference to profiles
  - `match_id` (uuid, foreign key) - Reference to matches
  - `predicted_home_score` (integer) - User's predicted home score
  - `predicted_away_score` (integer) - User's predicted away score
  - `points_earned` (integer) - Points earned (0 if match not completed)
  - `created_at` (timestamptz) - When prediction was made
  - `updated_at` (timestamptz) - Last update timestamp
  - UNIQUE constraint on (user_id, match_id) - One prediction per user per match

  ## Security
  - Enable RLS on all tables
  - Profiles: Users can read all profiles, but only update their own
  - Teams: Public read access, no write access for regular users
  - Matches: Public read access, no write access for regular users
  - Predictions: Users can read all predictions, create their own, and update only before match starts

  ## Notes
  - Points calculation:
    * Exact score: 5 points
    * Correct winner + correct goal difference: 3 points
    * Correct winner only: 1 point
    * Draw predicted correctly: 3 points
    * Wrong prediction: 0 points
  - Predictions can only be made/edited before match starts
  - Points are calculated when match results are entered
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  flag_emoji text NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id uuid REFERENCES teams(id) NOT NULL,
  away_team_id uuid REFERENCES teams(id) NOT NULL,
  match_date timestamptz NOT NULL,
  round integer NOT NULL DEFAULT 1,
  stage text NOT NULL DEFAULT 'group_stage',
  group_name text,
  home_score integer,
  away_score integer,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CHECK (home_team_id != away_team_id)
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  predicted_home_score integer NOT NULL CHECK (predicted_home_score >= 0),
  predicted_away_score integer NOT NULL CHECK (predicted_away_score >= 0),
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, match_id)
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Teams policies (public read)
CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

-- Matches policies (public read)
CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

-- Profiles policies
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Predictions policies
CREATE POLICY "Anyone can view predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own predictions"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions before match starts"
  ON predictions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = match_id 
      AND matches.match_date > now()
      AND matches.is_completed = false
    )
  )
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_completed ON matches(is_completed);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON profiles(total_points DESC);
