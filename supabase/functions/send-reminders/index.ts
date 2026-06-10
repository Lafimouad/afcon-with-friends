import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

type DueMatch = {
  id: string;
  match_date: string;
  home_team: { name: string | null } | null;
  away_team: { name: string | null } | null;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type InsertedReminderLog = {
  id: number;
  match_id: string;
};

type PushError = {
  statusCode?: number;
  status?: number;
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
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

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

  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(
      JSON.stringify({
        error:
          "Missing one or more VAPID secrets: VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const normalizedVapidSubject = vapidSubject.includes(":")
    ? vapidSubject
    : `mailto:${vapidSubject}`;

  webpush.setVapidDetails(
    normalizedVapidSubject,
    vapidPublicKey,
    vapidPrivateKey,
  );

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

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth");

  if (subscriptionsError) {
    return new Response(JSON.stringify({ error: subscriptionsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (subscriptions || []) as PushSubscriptionRow[];
  if (rows.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        window: { from, to },
        dueMatches: matches.length,
        remindersLogged: 0,
        notificationsSent: 0,
        subscriptions: 0,
        message: "No active push subscriptions. Reminders were not marked as processed.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const logsToInsert = matches.map((match) => ({
    match_id: match.id,
    notification_type: "kickoff_30m",
    scheduled_for: new Date(new Date(match.match_date).getTime() - 30 * 60 * 1000).toISOString(),
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

  const insertedMatchIds = new Set(
    ((insertedLogs || []) as InsertedReminderLog[]).map((row) => row.match_id),
  );
  const matchesToNotify = matches.filter((match) => insertedMatchIds.has(match.id));

  if (matchesToNotify.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        window: { from, to },
        dueMatches: matches.length,
        remindersLogged: insertedLogs?.length || 0,
        notificationsSent: 0,
        message: "No new reminders to send (already processed).",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let notificationsSent = 0;
  const staleEndpoints = new Set<string>();

  for (const match of matchesToNotify) {
    const payload = JSON.stringify({
      title: "Match starts in 30 minutes",
      body: `${match.home_team?.name ?? "Home"} vs ${match.away_team?.name ?? "Away"}`,
      url: "/",
    });

    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
        notificationsSent += 1;
      } catch (err: unknown) {
        const pushErr = err as PushError;
        const statusCode = pushErr.statusCode || pushErr.status;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.add(sub.endpoint);
        }
      }
    }
  }

  if (staleEndpoints.size > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", Array.from(staleEndpoints));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      window: { from, to },
      dueMatches: matches.length,
      remindersLogged: insertedLogs?.length || 0,
      notificationsSent,
      staleSubscriptionsRemoved: staleEndpoints.size,
      message: "Reminder candidates logged and push notifications sent.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
