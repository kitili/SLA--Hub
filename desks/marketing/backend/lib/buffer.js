/**
 * Buffer.com GraphQL pull — Silverleaf publishes social from Buffer.
 * Personal API key: Buffer → Account → API settings (https://developers.buffer.com).
 */
const BUFFER_API = 'https://api.buffer.com';

function looksPlaceholder(value) {
  if (!value || !String(value).trim()) return true;
  return /replace|changethis|your-|example|placeholder|<.*>/i.test(String(value));
}

function isConfigured() {
  const key = process.env.BUFFER_API_KEY;
  return !looksPlaceholder(key) && String(key).length >= 12;
}

async function graphql(query, variables) {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.BUFFER_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Buffer API HTTP ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(json.errors?.map((e) => e.message).join('; ') || `Buffer API HTTP ${res.status}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

function metricMap(metrics) {
  const out = {};
  for (const m of metrics || []) {
    const key = String(m.type || m.name || '').trim();
    if (!key) continue;
    out[key] = Number(m.value) || 0;
  }
  return out;
}

function platformName(service) {
  const s = String(service || 'other').toLowerCase();
  if (s === 'googlebusiness') return 'google';
  if (s === 'startpage') return 'startpage';
  return s;
}

async function syncAnalytics(db) {
  if (!isConfigured()) {
    return { skipped: true, reason: 'BUFFER_API_KEY is not set. Create one in Buffer → API settings.' };
  }

  const account = await graphql(`
    query {
      account {
        organizations { id name }
      }
    }
  `);
  const orgs = account?.account?.organizations || [];
  const orgId = process.env.BUFFER_ORGANIZATION_ID || orgs[0]?.id;
  if (!orgId) {
    return { skipped: true, reason: 'Buffer account has no organization.' };
  }

  const chData = await graphql(`
    query ($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id name displayName service isDisconnected
      }
    }
  `, { organizationId: orgId });

  const channels = (chData?.channels || []).filter((c) => !c.isDisconnected);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const today = now.toISOString().slice(0, 10);

  const byPlatform = {};
  const errors = [];

  for (const ch of channels) {
    const platform = platformName(ch.service);
    let metrics = [];
    try {
      const agg = await graphql(`
        query ($input: AggregatedPostMetricsInput!) {
          aggregatedPostMetrics(input: $input) {
            metrics { type name value unit }
            metricsUpdatedAt
          }
        }
      `, {
        input: {
          organizationId: orgId,
          startDateTime: start.toISOString(),
          endDateTime: now.toISOString(),
          channelIds: [ch.id],
        },
      });
      metrics = agg?.aggregatedPostMetrics?.metrics || [];
    } catch (err) {
      errors.push({ channel: ch.name || ch.id, error: err.message });
    }

    const m = metricMap(metrics);
    const bucket = byPlatform[platform] || {
      platform,
      posts_count: 0,
      reach: 0,
      impressions: 0,
      reactions: 0,
      comments: 0,
      follows: 0,
      engagementRate: 0,
      channels: [],
    };
    bucket.posts_count += m.postCount || 0;
    bucket.reach += m.reach || 0;
    bucket.impressions += m.impressions || m.views || 0;
    bucket.reactions += m.reactions || 0;
    bucket.comments += m.comments || 0;
    bucket.follows += m.follows || 0;
    if (m.engagementRate) bucket.engagementRate = Math.max(bucket.engagementRate, m.engagementRate);
    bucket.channels.push({ id: ch.id, name: ch.displayName || ch.name, service: ch.service, metrics: m });
    byPlatform[platform] = bucket;
  }

  let upserted = 0;
  for (const row of Object.values(byPlatform)) {
    const impressions = row.impressions || 0;
    const engagement = row.engagementRate
      || (impressions ? Math.round(((row.reactions + row.comments) / impressions) * 10000) / 100 : 0);

    await db.query(
      `DELETE FROM social_analytics
       WHERE campus_id IS NULL AND platform = $1 AND date = $2
         AND source IN ('buffer','puffer')`,
      [row.platform, today]
    );
    await db.query(
      `INSERT INTO social_analytics
         (campus_id, platform, date, followers, reach, impressions, engagement_rate, posts_count, source, raw_payload)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, 'buffer', $8)`,
      [
        row.platform,
        today,
        row.follows || 0,
        row.reach,
        impressions,
        engagement,
        row.posts_count,
        JSON.stringify({ organizationId: orgId, channels: row.channels }),
      ]
    );
    upserted += 1;
  }

  return {
    skipped: false,
    organizationId: orgId,
    channels: channels.length,
    platforms: Object.keys(byPlatform),
    upserted,
    errors,
  };
}

module.exports = { isConfigured, syncAnalytics };
