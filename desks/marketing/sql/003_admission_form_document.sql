-- ============================================================
-- ADMISSION FORM DOCUMENT
-- Single reusable file (PDF/Word) marketing staff upload once;
-- "Send Admission Form Link" attaches/links to whatever is
-- stored here. Singleton row (id fixed to 1) — re-uploading
-- replaces the current form rather than keeping a history.
-- ============================================================
CREATE TABLE IF NOT EXISTS admission_form_document (
    id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    file_url    TEXT NOT NULL,
    file_name   VARCHAR(200) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
