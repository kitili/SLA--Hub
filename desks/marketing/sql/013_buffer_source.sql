-- Buffer.com is the social publisher (source=buffer). Keep legacy puffer rows valid.
ALTER TABLE social_analytics DROP CONSTRAINT IF EXISTS social_analytics_source_check;
ALTER TABLE social_analytics
  ADD CONSTRAINT social_analytics_source_check
  CHECK (source IN ('manual', 'puffer', 'buffer', 'api'));
