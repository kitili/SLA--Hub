-- Normalize existing parent phone numbers to +255 E.164 format.
-- Run in Supabase SQL Editor. Safe to re-run — only touches rows not
-- already in +255 format, and only where the result is unambiguous
-- (9 digits after stripping a leading 0, starting with 6 or 7).

update public.parents
set phone = '+255' || regexp_replace(phone, '^0', '')
where phone !~ '^\+255'
  and regexp_replace(phone, '^0', '') ~ '^[67][0-9]{8}$';

-- Anything left here didn't match a clean pattern and needs manual
-- review rather than an automatic guess (e.g. the known 11-digit
-- outlier, '07599886984' — one digit too many to normalize safely).
select id, full_name, phone
from public.parents
where phone !~ '^\+255[67][0-9]{8}$';
