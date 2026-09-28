-- Atomic, gap-tolerant numbering for human-facing ticket references (TCK-000123).
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq;

-- Keep tickets.search_vector in sync so "similar tickets" full-text search stays current
-- without the application needing to remember to update it on every write.
CREATE OR REPLACE FUNCTION tickets_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.issue, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_search_vector_trigger
BEFORE INSERT OR UPDATE OF issue ON tickets
FOR EACH ROW EXECUTE FUNCTION tickets_search_vector_update();

CREATE INDEX IF NOT EXISTS tickets_search_vector_idx ON tickets USING GIN (search_vector);
