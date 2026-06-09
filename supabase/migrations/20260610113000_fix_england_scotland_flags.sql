-- Fix England and Scotland flags for already-seeded teams.

BEGIN;

UPDATE teams
SET flag_emoji = U&'\+01F3F4\+0E0067\+0E0062\+0E0065\+0E006E\+0E0067\+0E007F'
WHERE code = 'ENG' OR name = 'England';

UPDATE teams
SET flag_emoji = U&'\+01F3F4\+0E0067\+0E0062\+0E0073\+0E0063\+0E0074\+0E007F'
WHERE code = 'SCO' OR name = 'Scotland';

COMMIT;
