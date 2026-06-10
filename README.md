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

## GitHub Cron For Match Reminders

This repo includes a GitHub Actions cron workflow that runs every 5 minutes:

- .github/workflows/send-match-reminders.yml

### Setup

1. In GitHub repo settings, open Secrets and variables > Actions.
2. Add these repository secrets:
	- REMINDER_ENDPOINT: Your reminder API URL (for example Supabase Edge Function URL)
	- CRON_AUTH_TOKEN: Shared bearer token checked by your reminder endpoint
3. Ensure the endpoint accepts POST requests with:
	- Authorization: Bearer <CRON_AUTH_TOKEN>
	- JSON body: {"source":"github-actions","mode":"scheduled"}
4. Push to default branch and confirm the workflow appears under Actions.

### Manual Test

Run workflow_dispatch from the Actions tab to test reminder delivery immediately.

## Supabase Edge Function Setup (Recommended)

Use this with the GitHub cron workflow for free scheduled reminder checks.

### Files Added

- supabase/functions/send-reminders/index.ts
- supabase/migrations/20260610130000_create_match_reminder_logs.sql

### Step-by-step

1. Run migration in Supabase SQL Editor:
	- supabase/migrations/20260610130000_create_match_reminder_logs.sql
2. Deploy edge function (CLI):
	- supabase login
	- supabase link --project-ref <your-project-ref>
	- supabase functions deploy send-reminders --no-verify-jwt
3. Set edge function secret:
	- supabase secrets set CRON_AUTH_TOKEN=<your-generated-token>
	- supabase secrets set VAPID_SUBJECT=<mailto:you@example.com>
	- supabase secrets set VAPID_PUBLIC_KEY=<your-vapid-public-key>
	- supabase secrets set VAPID_PRIVATE_KEY=<your-vapid-private-key>
4. Set GitHub repository secrets:
	- REMINDER_ENDPOINT=https://<your-project-ref>.functions.supabase.co/send-reminders
	- CRON_AUTH_TOKEN=<same token as step 3>
5. Run GitHub workflow manually once from Actions tab (workflow_dispatch).

### What It Does

- Every 5 minutes, GitHub calls the edge function.
- The function checks matches starting in 25-35 minutes.
- It logs one reminder event per match in match_reminder_logs (deduplicated).
- It sends web push notifications to subscribed browsers.

## Browser Push Subscriptions (Step 1 + 2)

This setup enables users to opt in/out of browser notifications and stores subscriptions in Supabase.

### Files Added

- public/push-sw.js
- src/NotificationToggle.js
- supabase/migrations/20260610150000_create_push_subscriptions.sql

### Setup

1. Run migration in Supabase SQL Editor:
	- supabase/migrations/20260610150000_create_push_subscriptions.sql
2. Add VAPID public key to environment:
	- REACT_APP_VAPID_PUBLIC_KEY=<your-public-vapid-key>
3. Deploy/restart app.
4. Sign in and click Enable Notifications in header.

### Notes

- Notifications require HTTPS (or localhost in development level).
- On iOS Safari, push works only for installed PWAs (Add to Home Screen).
- Current reminder function logs due reminders; sending actual web push payloads can be wired next.
