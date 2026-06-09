-- World Cup 2026 bootstrap for a fresh Supabase database
-- This script creates schema, RLS policies, and seed data used by the app.
-- Seed strategy:
-- 1) 48 placeholder teams (A1..L4) so you can start immediately
-- 2) 72 group-stage fixtures across groups A..L
-- You can replace team names/codes later once final qualified teams are confirmed.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop old objects if they exist in this database
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Core tables
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  flag_emoji text NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id uuid NOT NULL REFERENCES teams(id),
  away_team_id uuid NOT NULL REFERENCES teams(id),
  match_date timestamptz NOT NULL,
  round integer NOT NULL DEFAULT 1,
  stage text NOT NULL DEFAULT 'group_stage',
  group_name text,
  home_score integer,
  away_score integer,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (home_team_id <> away_team_id)
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home_score integer NOT NULL CHECK (predicted_home_score >= 0),
  predicted_away_score integer NOT NULL CHECK (predicted_away_score >= 0),
  points_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_predictions_updated_at
BEFORE UPDATE ON predictions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Teams: authenticated users can read
CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

-- Matches: authenticated users can read
CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: read all, insert/update self
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile during signup"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Predictions: read all, write own, update only before kickoff
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
      SELECT 1
      FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.match_date > now()
        AND matches.is_completed = false
    )
  )
  WITH CHECK (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_completed ON matches(is_completed);
CREATE INDEX idx_matches_round ON matches(round);
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_profiles_points ON profiles(total_points DESC);

-- Seed 48 placeholder teams for World Cup 2026 (12 groups x 4 teams)
WITH groups(letter) AS (
  VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H'), ('I'), ('J'), ('K'), ('L')
)
INSERT INTO teams (name, flag_emoji, code)
SELECT
  'Group ' || groups.letter || ' - Team ' || s.slot AS name,
  '🏳️' AS flag_emoji,
  groups.letter || s.slot::text AS code
FROM groups
CROSS JOIN (VALUES (1), (2), (3), (4)) AS s(slot)
ORDER BY groups.letter, s.slot;

-- Seed 72 group-stage fixtures
-- Round=1 because knockout pairings are unknown until group stage is complete.
-- Kickoff hours below are stored in GMT+0.
WITH group_order AS (
  SELECT *
  FROM (VALUES
    ('A', 0), ('B', 1), ('C', 2), ('D', 3), ('E', 4), ('F', 5),
    ('G', 6), ('H', 7), ('I', 8), ('J', 9), ('K', 10), ('L', 11)
  ) AS t(group_name, day_offset)
),
fixtures AS (
  SELECT *
  FROM (VALUES
    (1, 1, 2, 15),
    (2, 3, 4, 18),
    (3, 1, 3, 15),
    (4, 2, 4, 18),
    (5, 4, 1, 15),
    (6, 2, 3, 18)
  ) AS f(match_in_group, home_slot, away_slot, kickoff_hour)
)
INSERT INTO matches (
  home_team_id,
  away_team_id,
  match_date,
  round,
  stage,
  group_name,
  is_completed
)
SELECT
  home_team.id,
  away_team.id,
  timestamptz '2026-06-11 00:00:00+00'
    + make_interval(days => group_order.day_offset, hours => fixtures.kickoff_hour),
  1,
  'group_stage',
  group_order.group_name,
  false
FROM group_order
JOIN fixtures ON true
JOIN teams AS home_team ON home_team.code = group_order.group_name || fixtures.home_slot::text
JOIN teams AS away_team ON away_team.code = group_order.group_name || fixtures.away_slot::text
ORDER BY group_order.group_name, fixtures.match_in_group;

COMMIT;
