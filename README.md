# World Cup 2026 Predictions

Predict World Cup 2026 match scores with friends, track points live, and view leaderboard, stats, and final reports.

## Features

- Match-by-match score predictions
- Locked rounds progression
- Live leaderboard and tournament stats
- Admin result entry and automatic point calculation
- Supabase-backed auth and data storage

## Run locally

1. Install dependencies:
	npm install
2. Set your Supabase credentials in your environment.
3. Start the app:
	npm start

## Supabase

- Base schema: supabase/migrations/20251221211800_create_afcon_prediction_schema.sql
- Friend account helper: supabase/create_friends_accounts.sql

## Fresh Database Setup (Old DB Closed)

1. Create a new Supabase project.
2. Open SQL Editor and run: supabase/setup_world_cup_2026.sql
3. In project settings, copy URL and anon key into .env:
	REACT_APP_SUPABASE_URL=...
	REACT_APP_SUPABASE_ANON_KEY=...
4. Restart the app with npm start.

Notes:
- The setup script seeds 48 placeholder teams (A1..L4) and all 72 group-stage matches.
- Knockout teams can be inserted/updated later once qualified teams are known.
- Seeded Round 1 kickoff times are stored in GMT+0.

### Timezone Correction (Round 1 GMT+1 -> GMT+0)

Only if you already inserted matches with GMT+1 times, run this migration once:

- supabase/migrations/20260609120000_shift_round1_to_gmt0.sql

### Seed Real Round 1 Fixtures

If you want to replace placeholder teams/matches with your real Round 1 list (already in GMT+0), run:

- supabase/migrations/20260609123000_seed_round1_real_fixtures_gmt0.sql

### Seed Real Round 2 Fixtures

After Round 1 teams are seeded, run this to add Round 2 real fixtures (GMT+0):

- supabase/migrations/20260610110000_seed_round2_real_fixtures_gmt0.sql

### Seed Real Round 3 Fixtures

After Round 2 is seeded, run this to add Round 3 real fixtures (GMT+0):

- supabase/migrations/20260610120000_seed_round3_real_fixtures_gmt0.sql
