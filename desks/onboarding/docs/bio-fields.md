# Bio-Data Field Specification (M5)

Derived from: `https://github.com/Nehemia-joh/Recruitment-Bio-Data` (Silverleaf Academy Employee Bio-Data Registration Form).
Source analysed: `index.php` (form + submission handler), `databse/Recruitment.sql` (full schema dump), `admin/view_employee.php` (read/display paths).
No PHP or SQL code was copied — concepts and field names only.

---

## 1. Overview

The source app collects a comprehensive employment bio-data record for new staff at Silverleaf Academy (Tanzania). A recruit fills in a single multi-section web form. On submission the data is persisted across **9 database tables** (plus one admin/auth table). The form is divided into 13 named sections progressing from personal identity through contact details, government IDs, employment, banking, document uploads, family, legal declaration, references, and a certification checkbox.

**Summary counts:**
- Flat (1:1 with profile) fields: **37 data columns** across personal, contact, ID/government numbers, employment, banking, and legal sections.
- Repeating (1:many) groups: **7** — children, family contacts, emergency contacts, relatives employed at Silverleaf, qualifications, employment history, references.
- Document upload slots: **6 types** (passport photo, CV, national ID, birth certificate, + unlimited professional certificates + unlimited academic certificates).
- Certification fields (declaration): **2** (name-as-used-officially, certification date) + 1 agreement checkbox.

---

## 2. Field Groups

### 2.1 Personal Information (Section 1)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `surname` | Surname | text | YES | "Surename" in UI (typo in source) |
| `first_name` | First Name | text | YES | |
| `middle_name` | Middle Name | text | no | |
| `other_names` | Other Names | text | no | |
| `maiden_name` | Maiden Name | text | no | For married women who changed surname |
| `gender` | Gender | enum | YES | MALE, FEMALE |
| `marital_status` | Marital Status | enum | YES | Single, Married, Divorced, Widowed, Separated |
| `date_of_birth` | Date of Birth | date | no | **PII-sensitive** |
| `place_of_birth` | Place of Birth | text | no | **PII-sensitive** |
| `nationality` | Nationality | text | no | Default: "Tanzanian" |
| `has_disabilities` | Do you have any disabilities? | enum | no | Yes, No (default No) |
| `disabilities_details` | If yes, please specify | textarea | no | Conditional on `has_disabilities = Yes` |

### 2.2 Contact Information (Section 2)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `home_phone` | Home Phone | phone | no | **PII-sensitive** |
| `mobile_phone` | Mobile Phone | phone | YES | **PII-sensitive** |
| `email` | Email Address | email | no | **PII-sensitive** |
| `residential_address` | Residential Address | textarea | YES | **PII-sensitive** |

### 2.3 Identification Documents (Section 3)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `identification_no` | National ID / NIDA | text | YES | **PII-sensitive** — Tanzanian national ID number |
| `id_place_of_issue` | Place of Issue (National ID) | text | no | |
| `id_expiry_date` | Expiry Date (National ID) | date | no | |
| `driving_permit_no` | Driving Permit Number | text | no | **PII-sensitive** |
| `driving_place_of_issue` | Place of Issue (Driving Permit) | text | no | |
| `driving_expiry_date` | Expiry Date (Driving Permit) | date | no | |
| `nssf_no` | NSSF Number | text | no | **PII-sensitive** — National Social Security Fund (Tanzania) |
| `tin_no` | TIN Number | text | no | **PII-sensitive** — Tax Identification Number |
| `nhif_no` | NHIF Number | text | no | **PII-sensitive** — National Health Insurance Fund |

### 2.4 Employment Details (Section 4)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `position` | Position (current/applied) | text | YES | Job title at Silverleaf |
| `work_station` | Work Station | text | no | Campus / department assignment |

### 2.5 Banking Information (Section 5)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `bank_name` | Bank Name | text | no | Default: "CRDB" |
| `account_name` | Account Name | text | no | **PII-sensitive** |
| `account_number` | Account Number | text | no | **PII-sensitive** |
| `mobile_money_number` | Mobile Money Number | phone | no | **PII-sensitive** |

### 2.6 Document Uploads (Section 6)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `passport_photo` | Passport Photo | file | no | image/*; max 2 MB |
| `birth_certificate` | Birth Certificate | file | no | PDF/JPG/PNG; max 3 MB; **PII-sensitive** |
| `cv` | Curriculum Vitae | file | no | PDF/DOC/DOCX; max 5 MB |
| `national_id` (scan) | National ID Scan | file | no | PDF/JPG/PNG; max 3 MB; **PII-sensitive** |
| `professional_certificates[]` | Professional Certificate(s) | file[] | no | Multiple allowed; PDF/JPG/PNG; max 5 MB each |
| `academic_certificates[]` | Academic Certificate(s) | file[] | no | Multiple allowed; PDF/JPG/PNG; max 5 MB each |

All uploaded files are stored in `employee_documents` (see section 3).

### 2.7 Legal & Conduct Information (Section 11)

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `arrest_record` | Ever arrested / detained / deported? | enum | no | Yes, No (default No) |
| `arrest_details` | If yes, give details (arrest) | textarea | no | Conditional on `arrest_record = Yes` |
| `misconduct_record` | Ever discharged / forced to resign for misconduct? | enum | no | Yes, No (default No) |
| `misconduct_details` | If yes, give details (misconduct) | textarea | no | Conditional on `misconduct_record = Yes` |

### 2.8 Certification / Declaration (Section 13)

These are form-submission fields, not stored as data columns — they confirm truthfulness.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `certification_name` | Name as used officially | text | no | Not persisted to DB in source; human decision needed (see §5) |
| `certification_date` | Date of signing | date | no | Not persisted to DB in source |
| `certification_agreement` | I certify the information is true | boolean/checkbox | YES | Must be checked to submit |

---

## 3. Repeating Sections

Each of these is a one-to-many group relative to the member profile.

### 3.1 Spouse (Section 7a)
At most one record per employee (UNIQUE KEY on `employee_id` in source). Conditionally shown for married employees.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `full_name` | Spouse Full Name | text | no | **PII-sensitive** |
| `phone` | Spouse Phone | phone | no | **PII-sensitive** |
| `occupation` | Spouse Occupation | text | no | |
| `employer` | Spouse Employer | text | no | |

Proposed child table: `member_spouses`

### 3.2 Biological Children (Section 7b)
Unlimited rows, added via "Add Child" button.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `full_names` | Child's Full Name | text | no | **PII-sensitive** |
| `date_of_birth` | Date of Birth | date | no | **PII-sensitive** |
| `gender` | Gender | enum | no | MALE, FEMALE, Other |
| `school_employer` | School / Employer | text | no | Current school or employer of the child |
| `contact_number` | Contact Number | phone | no | **PII-sensitive** |

Proposed child table: `member_children`

### 3.3 Family Contacts — Parents & Siblings (Section 7c)
Unlimited rows. Relationship is a fixed enum in the form.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `relationship` | Relationship | enum | no | Father, Mother, Brother, Sister, Guardian |
| `full_name` | Full Name | text | no | **PII-sensitive** |
| `phone` | Phone | phone | no | **PII-sensitive** |
| `address` | Address | textarea | no | **PII-sensitive** |
| `occupation` | Occupation | text | no | |

Proposed child table: `member_family_contacts`

### 3.4 Emergency Contacts (Section 7d)
Unlimited rows. Has a priority field (Primary / Secondary).

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `full_name` | Full Name | text | no | **PII-sensitive** |
| `relationship` | Relationship | text | no | Free text in form |
| `phone` | Phone | phone | no | **PII-sensitive** |
| `address` | Address | textarea | no | **PII-sensitive** |
| `priority` | Priority | enum | no | Primary, Secondary (default Primary) |

Proposed child table: `member_emergency_contacts`

### 3.5 Relatives Employed at Silverleaf (Section 8)
Unlimited rows. Captures relatives already working at the institution.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `full_name` | Full Name | text | no | **PII-sensitive** (third-party) |
| `relationship` | Relationship | text | no | |
| `position` | Position | text | no | Their job title |
| `work_station` | Work Station | text | no | |

Proposed child table: `member_relatives_employed`

### 3.6 Qualifications / Education (Section 9)
Unlimited rows. Covers both academic and professional qualifications.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `level` | Level | enum | no | Certificate, Diploma, Degree, Masters, PhD |
| `qualification` | Qualification | text | no | Name of degree/certificate |
| `institution` | Institution | text | no | Awarding institution |
| `year_obtained` | Year Obtained | number | no | 4-digit year (1900–2099) |

Note: The source DB also has a `document_ref` column (unused in form — always NULL). Skip in reimplementation unless a future need arises.

Proposed child table: `member_qualifications`

### 3.7 Employment History (Section 10)
Unlimited rows, most-recent first by `date_from`.

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `employer` | Employer | text | no | Previous employer name |
| `position` | Position | text | no | Job title held |
| `date_from` | Date From | date | no | Start date |
| `date_to` | Date To | date | no | End date (null = present) |
| `leaving_reason` | Reason for Leaving | textarea | no | |

Proposed child table: `member_employment_history`

### 3.8 References (Section 12)
Fixed at exactly 3 referees (ref1, ref2, ref3 in form). Must be persons not related by blood or marriage. All three `_name` fields are marked required in the HTML. Stored with an explicit `reference_order` (1, 2, 3).

| Field | Label (EN) | Type | Required | Options / Notes |
|---|---|---|---|---|
| `full_name` | Full Name | text | YES (all 3) | |
| `relationship` | Relationship (professional) | text | no | e.g. "Former Supervisor" |
| `phone` | Phone | phone | no | **PII-sensitive** (third-party) |
| `email` | Email | email | no | **PII-sensitive** (third-party) |
| `organization` | Organization | text | no | |
| `reference_order` | Order (1, 2, 3) | number | no | Sequence for display |

Proposed child table: `member_references`

---

## 4. Proposed `member_profiles` Model

This is the flat (1:1) table — one row per member. All columns correspond directly to the source `employees` table plus the certification fields identified above.

Conventions used:
- PII-sensitive fields are marked **[PII]**
- EN label key = i18n key suggested for forms/display
- SW label key = Swahili translation key
- Drizzle column type suggestions follow Drizzle ORM conventions

### 4.1 member_profiles (1:1 with members/users table)

| Column | EN Label Key | SW Label Key | Drizzle Type | Required | PII | Notes |
|---|---|---|---|---|---|---|
| `id` | — | — | serial / uuid | YES | — | PK |
| `member_id` | — | — | integer FK | YES | — | FK to auth users/members table |
| `surname` | bio.surname | bio.jina_la_familia | varchar(100) | YES | YES | |
| `first_name` | bio.first_name | bio.jina_la_kwanza | varchar(100) | YES | YES | |
| `middle_name` | bio.middle_name | bio.jina_la_kati | varchar(100) | no | YES | |
| `other_names` | bio.other_names | bio.majina_mengine | varchar(255) | no | YES | |
| `maiden_name` | bio.maiden_name | bio.jina_la_useja | varchar(100) | no | YES | Birth surname before marriage |
| `gender` | bio.gender | bio.jinsia | varchar(50) | YES | YES | Enum: MALE, FEMALE |
| `marital_status` | bio.marital_status | bio.hali_ya_ndoa | varchar(50) | YES | YES | Enum: Single, Married, Divorced, Widowed, Separated |
| `date_of_birth` | bio.date_of_birth | bio.tarehe_ya_kuzaliwa | date | no | **[PII]** | |
| `place_of_birth` | bio.place_of_birth | bio.mahali_pa_kuzaliwa | varchar(150) | no | **[PII]** | |
| `nationality` | bio.nationality | bio.utaifa | varchar(100) | no | YES | Default "Tanzanian" |
| `has_disabilities` | bio.has_disabilities | bio.una_ulemavu | varchar(50) | no | YES | Enum: Yes, No |
| `disabilities_details` | bio.disabilities_details | bio.maelezo_ya_ulemavu | text | no | YES | Shown if has_disabilities=Yes |
| `home_phone` | bio.home_phone | bio.simu_ya_nyumbani | varchar(50) | no | **[PII]** | |
| `mobile_phone` | bio.mobile_phone | bio.simu_ya_mkononi | varchar(50) | YES | **[PII]** | |
| `email` | bio.email | bio.barua_pepe | varchar(255) | no | **[PII]** | |
| `residential_address` | bio.residential_address | bio.anwani_ya_makazi | text | YES | **[PII]** | |
| `identification_no` | bio.national_id_no | bio.namba_ya_kitambulisho | varchar(50) | YES | **[PII]** | NIDA number |
| `id_place_of_issue` | bio.id_place_of_issue | bio.mahali_pa_kutolewa_kitambulisho | varchar(150) | no | YES | |
| `id_expiry_date` | bio.id_expiry_date | bio.tarehe_ya_kumalizika_kitambulisho | date | no | YES | |
| `driving_permit_no` | bio.driving_permit_no | bio.namba_ya_leseni | varchar(50) | no | **[PII]** | |
| `driving_place_of_issue` | bio.driving_place_of_issue | bio.mahali_pa_kutolewa_leseni | varchar(150) | no | YES | |
| `driving_expiry_date` | bio.driving_expiry_date | bio.tarehe_ya_kumalizika_leseni | date | no | YES | |
| `nssf_no` | bio.nssf_no | bio.namba_ya_nssf | varchar(50) | no | **[PII]** | National Social Security Fund |
| `tin_no` | bio.tin_no | bio.namba_ya_tin | varchar(50) | no | **[PII]** | Tax Identification Number |
| `nhif_no` | bio.nhif_no | bio.namba_ya_nhif | varchar(50) | no | **[PII]** | National Health Insurance Fund |
| `position` | bio.position | bio.cheo | varchar(150) | YES | no | Job title at Silverleaf |
| `work_station` | bio.work_station | bio.kituo_cha_kazi | varchar(150) | no | no | Campus / department |
| `bank_name` | bio.bank_name | bio.jina_la_benki | varchar(100) | no | YES | Default "CRDB" |
| `account_name` | bio.account_name | bio.jina_la_akaunti | varchar(255) | no | **[PII]** | |
| `account_number` | bio.account_number | bio.namba_ya_akaunti | varchar(50) | no | **[PII]** | |
| `mobile_money_number` | bio.mobile_money_number | bio.namba_ya_pesa_mkononi | varchar(50) | no | **[PII]** | M-Pesa / Tigo Pesa etc. |
| `arrest_record` | bio.arrest_record | bio.rekodi_ya_kukamatwa | varchar(10) | no | YES | Enum: Yes, No |
| `arrest_details` | bio.arrest_details | bio.maelezo_ya_kukamatwa | text | no | YES | Shown if arrest_record=Yes |
| `misconduct_record` | bio.misconduct_record | bio.rekodi_ya_makosa | varchar(10) | no | YES | Enum: Yes, No |
| `misconduct_details` | bio.misconduct_details | bio.maelezo_ya_makosa | text | no | YES | Shown if misconduct_record=Yes |
| `certification_name` | bio.official_name | bio.jina_rasmi | varchar(255) | no | **[PII]** | Name as used officially — see §5 |
| `certification_date` | bio.certification_date | bio.tarehe_ya_uthibitisho | date | no | no | Date of declaration |
| `submitted_at` | — | — | timestamp | auto | no | When form was submitted |
| `updated_at` | — | — | timestamp | auto | no | Last update timestamp |

### 4.2 Proposed Child Tables

#### member_documents
Stores all uploaded file references (6 document types, some multiple).

| Column | Type | Notes |
|---|---|---|
| `id` | serial | PK |
| `member_profile_id` | integer FK | |
| `document_type` | varchar(100) | 'Passport Photo', 'Curriculum Vitae', 'National ID', 'Birth Certificate', 'Professional Certificate', 'Academic Certificate' |
| `file_path` | varchar(500) | Storage path / object key |
| `original_name` | varchar(255) | Original filename |
| `mime_type` | varchar(100) | |
| `file_size_bytes` | integer | |
| `uploaded_at` | timestamp | |

#### member_spouses
At most one per profile (1:1 relationship enforced via unique constraint on `member_profile_id`).

| Column | Type | PII | Notes |
|---|---|---|---|
| `id` | serial | | PK |
| `member_profile_id` | integer FK | | UNIQUE |
| `full_name` | varchar(255) | **[PII]** | |
| `phone` | varchar(50) | **[PII]** | |
| `occupation` | varchar(150) | | |
| `employer` | varchar(255) | | |

#### member_children
Multiple per profile.

| Column | Type | PII | Notes |
|---|---|---|---|
| `id` | serial | | PK |
| `member_profile_id` | integer FK | | |
| `full_names` | varchar(255) | **[PII]** | |
| `date_of_birth` | date | **[PII]** | |
| `gender` | varchar(50) | | Enum: MALE, FEMALE, Other |
| `school_employer` | varchar(255) | | |
| `contact_number` | varchar(50) | **[PII]** | |

#### member_family_contacts
Parents, siblings, guardians.

| Column | Type | PII | Notes |
|---|---|---|---|
| `id` | serial | | PK |
| `member_profile_id` | integer FK | | |
| `relationship` | varchar(50) | | Enum: Father, Mother, Brother, Sister, Guardian |
| `full_name` | varchar(255) | **[PII]** | |
| `phone` | varchar(50) | **[PII]** | |
| `address` | text | **[PII]** | |
| `occupation` | varchar(150) | | |

#### member_emergency_contacts

| Column | Type | PII | Notes |
|---|---|---|---|
| `id` | serial | | PK |
| `member_profile_id` | integer FK | | |
| `full_name` | varchar(255) | **[PII]** | |
| `relationship` | varchar(100) | | Free text |
| `phone` | varchar(50) | **[PII]** | |
| `address` | text | **[PII]** | |
| `priority` | varchar(20) | | Enum: Primary, Secondary |

#### member_relatives_employed
Relatives already working at Silverleaf.

| Column | Type | PII | Notes |
|---|---|---|---|
| `id` | serial | | PK |
| `member_profile_id` | integer FK | | |
| `full_name` | varchar(255) | **[PII]** | Third-party PII |
| `relationship` | varchar(100) | | |
| `position` | varchar(150) | | |
| `work_station` | varchar(150) | | |

#### member_qualifications
Academic and professional qualifications.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | PK |
| `member_profile_id` | integer FK | |
| `level` | varchar(100) | Enum: Certificate, Diploma, Degree, Masters, PhD |
| `qualification` | varchar(255) | Name of degree/certification |
| `institution` | varchar(255) | |
| `year_obtained` | integer | 4-digit year |

#### member_employment_history

| Column | Type | Notes |
|---|---|---|
| `id` | serial | PK |
| `member_profile_id` | integer FK | |
| `employer` | varchar(255) | |
| `position` | varchar(150) | |
| `date_from` | date | |
| `date_to` | date | null = current/present |
| `leaving_reason` | text | |

#### member_references
Exactly 3 per profile as designed in source; enforce via `reference_order` 1–3.

| Column | Type | PII | Notes |
|---|---|---|---|
| `id` | serial | | PK |
| `member_profile_id` | integer FK | | |
| `reference_order` | integer | | 1, 2, or 3 |
| `full_name` | varchar(255) | **[PII]** (third-party) | Required per source |
| `relationship` | varchar(100) | | Professional relationship |
| `phone` | varchar(50) | **[PII]** (third-party) | |
| `email` | varchar(255) | **[PII]** (third-party) | |
| `organization` | varchar(255) | | |

---

## 5. Notes & Ambiguities

1. **`certification_name` not persisted in source.** The source form captures "Name of employee as usually written and which will be used officially" but the submission handler does not insert it into the DB. We should decide whether to store this in `member_profiles.certification_name` (recommended) or derive it from the name fields. It could serve as the "preferred display name" for HR printing. Human decision needed.

2. **`age` derived column.** The source stores a computed `age` integer (calculated from DOB at submission time). This is stale the moment a year passes. We should compute age on-the-fly from `date_of_birth` and not store it as a column.

3. **`marital_status` required in source but not a DB NOT NULL constraint.** The SQL schema shows `marital_status VARCHAR(50) DEFAULT NULL`. Mark as required in form validation but make nullable in schema for draft/partial-save support.

4. **Gender enum values are uppercase in DB (`MALE`, `FEMALE`) but displayed as `Male`/`Female` in UI.** Decide on a canonical casing strategy; lowercase with label mapping is cleaner.

5. **`qualification_level` is a free-text DB column (`varchar(100)`)** in spite of the form restricting it to a fixed enum (Certificate, Diploma, Degree, Masters, PhD). Consider whether to add a DB enum constraint or leave as text to accommodate future levels.

6. **References section says "three persons NOT related by blood or marriage" but only `ref1_name` is actually enforced required in the PHP validation logic.** The HTML marks all three names as `required`. We should align on whether all 3 are mandatory or just 1.

7. **`has_disabilities` is stored as `VARCHAR(50)` with values "Yes"/"No"** — not a boolean. In Drizzle we should use a boolean column and convert the display label.

8. **`arrest_record` and `misconduct_record`** are stored as ENUM('Yes','No') in source DB. Same as disabilities — map to boolean in Drizzle.

9. **The `spouses` table has a UNIQUE constraint on `employee_id`** — meaning only one spouse per employee. This is consistent with the form design. Note: the form shows the spouse section unconditionally regardless of marital status. We should show it conditionally when `marital_status` = Married.

10. **`family_contacts` relationship** is an enum in the form (Father, Mother, Brother, Sister, Guardian) but stored as `varchar(50)` with no DB constraint. Consider whether to enforce the enum at the application level only.

11. **`emergency_contacts` relationship** is free text in the form (no dropdown). This differs from `family_contacts`. Keep as free text.

12. **`bank_name` default "CRDB"** is Tanzania-specific. We may want to make this a dropdown of local banks (CRDB, NMB, NBC, Stanbic, etc.) plus "Other" for flexibility.

13. **Mobile Money number** is captured as a plain text field with no carrier/type specification. We may want to add a `mobile_money_provider` field (e.g. M-Pesa, Tigo Pesa, Airtel Money, Halopesa).

14. **`nhif_no`** — NHIF (National Health Insurance Fund) was rebranded to SHA (Social Health Authority) in Kenya; the source is Tanzania-specific so NHIF is correct for TZ context. Confirm with HR.

15. **Document upload size limits** are enforced in HTML only in the source — no server-side validation shown. We must enforce these server-side in our implementation.

16. **`qualification.document_ref`** column exists in the source DB but is never populated by the form (always NULL). Omit from our schema unless HR confirms a use case.

17. **`relatives_employed` section** says "at Silverleaf Academy" — this means it captures conflict-of-interest / nepotism disclosure. Keep the label explicit.

18. **Certification date vs submission timestamp** — source stores `created_at` automatically. We have both `certification_date` (self-declared by employee) and `submitted_at` (system timestamp). Both should be stored.
