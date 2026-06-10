export const config = {
  runtime: 'nodejs18.x',
};

export default async function handler(req, res) {
  // Verify the request is from Vercel's cron
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Call your Supabase function
    const response = await fetch(
      'https://hwgjqbzpqajpojwcdsbj.supabase.co/functions/v1/send-reminders',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'vercel-cron',
          mode: 'scheduled',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Cron job failed:', error);
    return res.status(500).json({ error: error.message });
  }
}

export const crons = [
  {
    path: '/api/cron/send-reminders',
    schedule: '*/5 * * * *',
  },
];
