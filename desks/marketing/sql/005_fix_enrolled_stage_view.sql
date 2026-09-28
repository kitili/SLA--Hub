-- ============================================================
-- FIX: lead_computed_stages had no concept of "enrolled" — its
-- comment even said "enrolled handled by Ed Admin", but ANY
-- trigger-firing UPDATE on admission_applications (including the
-- Ed Admin webhook's own edadmin_ref backfill, or the manual
-- "Mark as Enrolled" action) recomputed the stage from this view
-- and silently reset it back to 'form_filled'. Now that
-- admission_applications tracks enrolled_at (see
-- 004_enrolment_tracking.sql), the view can represent 'enrolled'
-- correctly, so update_lead_stage() no longer clobbers it.
-- ============================================================
CREATE OR REPLACE VIEW lead_computed_stages AS
SELECT
    l.id,
    CASE
        WHEN ap.id IS NOT NULL THEN 'admission_paid'
        WHEN aa.id IS NOT NULL AND aa.enrolled_at IS NOT NULL THEN 'enrolled'
        WHEN aa.id IS NOT NULL THEN 'form_filled'
        WHEN tb.id IS NOT NULL THEN 'tour_booked'
        ELSE 'lead'
    END AS computed_stage
FROM marketing_leads l
LEFT JOIN LATERAL (
    SELECT id FROM admission_payments WHERE lead_id = l.id LIMIT 1
) ap ON TRUE
LEFT JOIN LATERAL (
    SELECT id, enrolled_at FROM admission_applications WHERE lead_id = l.id LIMIT 1
) aa ON TRUE
LEFT JOIN LATERAL (
    SELECT id FROM tour_bookings WHERE lead_id = l.id LIMIT 1
) tb ON TRUE;
