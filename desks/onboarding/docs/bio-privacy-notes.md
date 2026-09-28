# Bio Section — Privacy / DSGVO Notes (Wave 5A)

This document records the data-protection decisions baked into the member Bio
section and **flags items that need a human (HR / DPO) decision**. The Bio form
collects highly sensitive personal data (national ID, DOB, bank details, home
address, family members) including GDPR **Art. 9 special-category data**. Treat
this as the data-protection record for the feature until a formal DPIA exists.

## What was implemented

- **Privacy notice** at the top of the form (bilingual EN/SW): what is
  collected, the purpose (employment & onboarding), who can see it (the member +
  authorised HR admins), and that it is stored securely. Plain language, short.
- **Explicit consent** (GDPR Art. 6(1)(a) / Art. 7): a required checkbox —
  *"I consent to Silverleaf processing this information for employment and
  onboarding purposes."* The form cannot be submitted unless it is ticked
  (enforced in Zod via `z.literal(true)`).
- **Consent is persisted**: new columns on `member_profiles` —
  `consent_given_at timestamptz` and `consent_version text`. The action writes
  `new Date()` and `CONSENT_VERSION` (`"2026-06-bio-v1"`) on every save. Bump
  `CONSENT_VERSION` in `src/lib/actions/bio.ts` if the notice wording or
  processing purpose changes, so members can be re-prompted.
- **Access is per-member only**: the page and action resolve the member id from
  `getCurrentUser()` and **never** accept a `memberId` from the client. A member
  can only ever read/write their own profile.
- **Data minimization in logging**: no `console.*` of any field value anywhere
  in the Bio code. The catch block in the save action deliberately does not log
  the error object (it can echo input values).

## Special-category data (GDPR Art. 9) — FLAGGED FOR HUMAN REVIEW

All of the following are **optional** in the form (never required to submit),
are visually marked as sensitive with an inline note, and map to **nullable**
columns. The open question for HR/DPO is **whether they are necessary at all**
(data minimization, Art. 5(1)(c)).

| Field(s) | Category | Column(s) | Recommendation |
|---|---|---|---|
| `has_disabilities`, `disabilities_details` | Health (Art. 9) | `member_profiles.has_disabilities`, `.disabilities_details` | **Question necessity.** If collected only for workplace accommodation, consider capturing *accommodation needs* rather than a disability flag, and only after hire. If kept, document the Art. 9 condition relied on (likely Art. 9(2)(b) — employment-law obligations). |
| `arrest_record`, `arrest_details` | Criminal (Art. 10) | `member_profiles.arrest_record`, `.arrest_details` | **Question necessity.** "Ever arrested/detained/deported" is broad and arrest ≠ conviction. For a school, a formal background/police check is usually the lawful, proportionate route; a free-text self-declaration may be excessive. Confirm legal basis before keeping. |
| `misconduct_record`, `misconduct_details` | Conduct (sensitive) | `member_profiles.misconduct_record`, `.misconduct_details` | Lower risk than criminal history but still sensitive. Confirm it is needed for the hiring decision; if so keep optional. |

### Why these are only "optional", not removed

The source bio form (Silverleaf Recruitment Bio-Data) includes them, so they are
implemented for parity, but gated as optional + clearly labelled. **Removing them
is a policy decision, not a technical one** — hence this flag. If HR confirms any
are unnecessary, delete the field from `bioFormSchema` + `BioForm.tsx` and drop
the column in a follow-up migration.

## Other sensitive (non-Art. 9) data collected

National ID (NIDA), TIN, NSSF, NHIF, driving permit, bank account name/number,
mobile money number, residential address, DOB, and **third-party PII** (family
members, children, emergency contacts, referees). Third-party data is collected
on the member's say-so; HR should ensure referees/contacts are informed where
required.

## Recommended follow-ups (out of scope for Wave 5A)

1. **DPIA**: given Art. 9 + Art. 10 data and the volume of PII, a formal Data
   Protection Impact Assessment is advisable.
2. **Retention policy**: define how long bio records are kept after a member
   leaves, and implement deletion. (Schema already cascades on staff delete.)
3. **Encryption at rest** for the most sensitive columns (national ID, bank
   details) beyond database-level encryption, if the threat model warrants it.
4. **Audit log** of who (HR admin) views a member's bio record.
5. **Right to access / erasure** tooling (export + delete) for member requests.
6. **Document uploads** (`member_documents`) are not yet wired in this wave; when
   added, enforce server-side size/type limits and the same access controls.
