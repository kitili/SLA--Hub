// Real-time broadcast helper — replaces the old Socket.IO `io.to(room).emit(event, payload)`
// pattern. Serverless functions can't hold a persistent socket server, so instead of
// maintaining a WebSocket connection ourselves, we send a single HTTP call to Supabase's
// Realtime broadcast-over-REST endpoint; any client subscribed to that topic receives it.
//
// Topic names are unchanged from the old Socket.IO room scheme: `campus-${id}`, `global`,
// `user-${id}` — so the frontend's channel names match this 1:1.
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL environment variable is required.');

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!hasServiceRole) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is not set — realtime/storage calls will no-op until configured.');
}

const supabase = hasServiceRole
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function broadcast(topic, event, payload) {
  if (!supabase) {
    console.log(`Realtime (dev — no service role): ${topic}/${event}`);
    return;
  }
  try {
    const channel = supabase.channel(topic);
    await channel.send({ type: 'broadcast', event, payload });
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error(`Realtime broadcast failed (topic=${topic}, event=${event}):`, err.message);
  }
}

module.exports = { broadcast, supabase };
