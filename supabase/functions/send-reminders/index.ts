import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DueMatch = {
  id: string;
  match_date: string;
  home_team: { name: string | null } | null;
  away_team: { name: string | null } | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expectedToken = Deno.env.get("CRON_AUTH_TOKEN");
  const authHeader = req.headers.get("authorization") || "";
  const providedToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!expectedToken) {
    return new Response(
      JSON.stringify({ error: "Missing function secret: CRON_AUTH_TOKEN" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (providedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const from = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

  const { data: dueMatches, error: dueMatchesError } = await supabase
    .from("matches")
    .select(
      `
      id,
      match_date,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name)
    `,
    )
    .eq("is_completed", false)
    .gte("match_date", from)
    .lte("match_date", to)
    .order("match_date", { ascending: true });

  if (dueMatchesError) {
    return new Response(JSON.stringify({ error: dueMatchesError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const matches = (dueMatches || []) as DueMatch[];

  if (matches.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        window: { from, to },
        dueMatches: 0,
        remindersLogged: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const logsToInsert = matches.map((match) => ({
    match_id: match.id,
    notification_type: "kickoff_30m",
    scheduled_for: match.match_date,
    payload: {
      title: "Match starts in 30 minutes",
      body: `${match.home_team?.name ?? "Home"} vs ${match.away_team?.name ?? "Away"}`,
    },
  }));

  const { data: insertedLogs, error: insertError } = await supabase
    .from("match_reminder_logs")
    .upsert(logsToInsert, {
      onConflict: "match_id,notification_type",
      ignoreDuplicates: true,
    })
    .select("id, match_id");

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      window: { from, to },
      dueMatches: matches.length,
      remindersLogged: insertedLogs?.length || 0,
      message:
        "Reminder candidates logged. Hook your push sender to these events or extend this function.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
