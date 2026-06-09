-- Seed real World Cup 2026 Round 1 fixtures in GMT+0.
-- IMPORTANT: This replaces current teams/matches data.

BEGIN;

-- Clear dependent data first
DELETE FROM predictions;
DELETE FROM matches;
DELETE FROM teams;

INSERT INTO teams (name, flag_emoji, code)
VALUES
  ('Mexico', '🇲🇽', 'MEX'),
  ('South Africa', '🇿🇦', 'ZAF'),
  ('South Korea', '🇰🇷', 'KOR'),
  ('Czech Republic', '🇨🇿', 'CZE'),
  ('Canada', '🇨🇦', 'CAN'),
  ('Bosnia & Herzegovina', '🇧🇦', 'BIH'),
  ('USA', '🇺🇸', 'USA'),
  ('Paraguay', '🇵🇾', 'PAR'),
  ('Qatar', '🇶🇦', 'QAT'),
  ('Switzerland', '🇨🇭', 'SUI'),
  ('Brazil', '🇧🇷', 'BRA'),
  ('Morocco', '🇲🇦', 'MAR'),
  ('Haiti', '🇭🇹', 'HTI'),
  ('Scotland', U&'\+01F3F4\+0E0067\+0E0062\+0E0073\+0E0063\+0E0074\+0E007F', 'SCO'),
  ('Australia', '🇦🇺', 'AUS'),
  ('Turkey', '🇹🇷', 'TUR'),
  ('Germany', '🇩🇪', 'GER'),
  ('Curacao', '🇨🇼', 'CUW'),
  ('Netherlands', '🇳🇱', 'NED'),
  ('Japan', '🇯🇵', 'JPN'),
  ('Ivory Coast', '🇨🇮', 'CIV'),
  ('Ecuador', '🇪🇨', 'ECU'),
  ('Sweden', '🇸🇪', 'SWE'),
  ('Tunisia', '🇹🇳', 'TUN'),
  ('Spain', '🇪🇸', 'ESP'),
  ('Cape Verde', '🇨🇻', 'CPV'),
  ('Belgium', '🇧🇪', 'BEL'),
  ('Egypt', '🇪🇬', 'EGY'),
  ('Saudi Arabia', '🇸🇦', 'KSA'),
  ('Uruguay', '🇺🇾', 'URU'),
  ('Iran', '🇮🇷', 'IRN'),
  ('New Zealand', '🇳🇿', 'NZL'),
  ('France', '🇫🇷', 'FRA'),
  ('Senegal', '🇸🇳', 'SEN'),
  ('Iraq', '🇮🇶', 'IRQ'),
  ('Norway', '🇳🇴', 'NOR'),
  ('Argentina', '🇦🇷', 'ARG'),
  ('Algeria', '🇩🇿', 'ALG'),
  ('Austria', '🇦🇹', 'AUT'),
  ('Jordan', '🇯🇴', 'JOR'),
  ('Portugal', '🇵🇹', 'POR'),
  ('DR Congo', '🇨🇩', 'COD'),
  ('England', U&'\+01F3F4\+0E0067\+0E0062\+0E0065\+0E006E\+0E0067\+0E007F', 'ENG'),
  ('Croatia', '🇭🇷', 'CRO'),
  ('Ghana', '🇬🇭', 'GHA'),
  ('Panama', '🇵🇦', 'PAN'),
  ('Uzbekistan', '🇺🇿', 'UZB'),
  ('Colombia', '🇨🇴', 'COL');

WITH fixtures(home_team, away_team, kickoff_utc) AS (
  VALUES
    ('Mexico', 'South Africa', timestamptz '2026-06-11 19:00:00+00'),
    ('South Korea', 'Czech Republic', timestamptz '2026-06-12 02:00:00+00'),
    ('Canada', 'Bosnia & Herzegovina', timestamptz '2026-06-12 19:00:00+00'),
    ('USA', 'Paraguay', timestamptz '2026-06-13 01:00:00+00'),
    ('Qatar', 'Switzerland', timestamptz '2026-06-13 19:00:00+00'),
    ('Brazil', 'Morocco', timestamptz '2026-06-13 22:00:00+00'),
    ('Haiti', 'Scotland', timestamptz '2026-06-14 01:00:00+00'),
    ('Australia', 'Turkey', timestamptz '2026-06-14 04:00:00+00'),
    ('Germany', 'Curacao', timestamptz '2026-06-14 17:00:00+00'),
    ('Netherlands', 'Japan', timestamptz '2026-06-14 20:00:00+00'),
    ('Ivory Coast', 'Ecuador', timestamptz '2026-06-14 23:00:00+00'),
    ('Sweden', 'Tunisia', timestamptz '2026-06-15 02:00:00+00'),
    ('Spain', 'Cape Verde', timestamptz '2026-06-15 16:00:00+00'),
    ('Belgium', 'Egypt', timestamptz '2026-06-15 19:00:00+00'),
    ('Saudi Arabia', 'Uruguay', timestamptz '2026-06-15 22:00:00+00'),
    ('Iran', 'New Zealand', timestamptz '2026-06-16 01:00:00+00'),
    ('France', 'Senegal', timestamptz '2026-06-16 19:00:00+00'),
    ('Iraq', 'Norway', timestamptz '2026-06-16 22:00:00+00'),
    ('Argentina', 'Algeria', timestamptz '2026-06-17 01:00:00+00'),
    ('Austria', 'Jordan', timestamptz '2026-06-17 04:00:00+00'),
    ('Portugal', 'DR Congo', timestamptz '2026-06-17 17:00:00+00'),
    ('England', 'Croatia', timestamptz '2026-06-17 20:00:00+00'),
    ('Ghana', 'Panama', timestamptz '2026-06-17 23:00:00+00'),
    ('Uzbekistan', 'Colombia', timestamptz '2026-06-18 02:00:00+00')
)
INSERT INTO matches (home_team_id, away_team_id, match_date, round, stage, group_name, is_completed)
SELECT
  ht.id,
  at.id,
  f.kickoff_utc,
  1,
  'group_stage',
  NULL,
  false
FROM fixtures f
JOIN teams ht ON ht.name = f.home_team
JOIN teams at ON at.name = f.away_team
ORDER BY f.kickoff_utc;

COMMIT;
