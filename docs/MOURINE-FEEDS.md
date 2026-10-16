# Mourine feeds — tested paths

**For:** the four feeds asked of Mourine  
**Live site:** `https://onboarding.silverleaf.co.tz`  
**Checked:** 16 October 2026  
**Signed-in check:** local hub `http://127.0.0.1:3100` as an admin  
**Result:** 9 pages opened, 2 missing-record APIs answered

The admin screens still need a signed-in session. The same four feeds are also on `/api/v1`, and those accept `Authorization: Bearer $HUB_API_KEY`.

Checked locally on 16 October 2026 with a hub key:

| Request | Result |
|---|---|
| `GET /api/v1/journey` with no key | 401 |
| `GET /api/v1/journey` with the key | 200, count 2 |
| `GET /api/v1/hiring` with the key | 200, 10 stage names |
| `GET /api/v1/tickets` with the key | 200 |
| `GET /api/v1/catalog` with the key | 200 |

```bash
curl -H "Authorization: Bearer $HUB_API_KEY" \
  https://hub.silverleaf.co.tz/api/v1/journey
curl -H "Authorization: Bearer $HUB_API_KEY" \
  https://hub.silverleaf.co.tz/api/v1/hiring
curl -H "Authorization: Bearer $HUB_API_KEY" \
  https://hub.silverleaf.co.tz/api/v1/tickets
curl -H "Authorization: Bearer $HUB_API_KEY" \
  https://hub.silverleaf.co.tz/api/v1/catalog
```

Production serves these only after this change is deployed. File downloads use the same header on `GET /api/materials/{key}`.

Journey bio on this API is status only: submitted, name, position, and work station. Identification numbers, bank details, and conduct records stay off the feed. Hiring omits pipeline tokens.

On the live site, a request with no session returns **307** to `/en` (sign-in). That was checked for hiring, SLA-bot, sections, and bio.

## 1. Journey feed

| What | Path | Signed-in result |
|---|---|---|
| Progress | `/en` | 200, Dashboard |
| Bio | `/en/bio` | 200, Bio Data Form |
| Sign-off | `/en/sign-off` | 200, Sign Off |
| Feedback | `/en/feedback` | 200, Feedback |
| One person | `/en/admin/members/{memberId}` | members list 200 |
| Bio PDF | `GET /api/admin/members/{memberId}/bio-pdf` | 404 `no-bio` when that member has no bio |

## 2. Hiring feed

| What | Path | Signed-in result |
|---|---|---|
| Board | `/en/admin/hiring` | 200, Hiring Pipeline. Page includes New, Culture, and Hired |
| One candidate | `/en/admin/hiring/candidates/{id}` | opened from the board |

Stage names, in pipeline order:

| Stage id | Label |
|---|---|
| `incomplete_application` | Incomplete Application |
| `new` | New |
| `culture_video_requested` | Culture Video Requested |
| `culture_video_submitted` | Culture Video Submitted |
| `performance_task_requested` | Performance Task Requested |
| `performance_task_submitted` | Performance Task Submitted |
| `online_interview_requested` | Online Interview Requested |
| `in_person_interview_requested` | In-Person Interview Requested |
| `hired` | Hired |
| `rejected` | Rejected |

A hired person's work email is `work_email` on that candidate. There is no `GET` list of candidates.

## 3. Tickets feed

| What | Path | Signed-in result |
|---|---|---|
| SLA-bot alarms and questions | `/en/admin/sla-bot` | 200. Page includes SLA-bot and alerts |

There is no `GET` for the alert list.

## 4. Course catalog

| What | Path | Signed-in result |
|---|---|---|
| Sections | `/en/admin/sections` | 200, Sections |
| Items in one section | `/en/admin/sections/{sectionId}` | opened from the sections list |
| PDFs and videos | `/en/admin/materials` | 200, Materials |
| One file | `GET /api/materials/{key}` | 404 `Not found` for a missing key |

Videos are YouTube rows on the materials screen. There is no separate video list.

## How to open them

```text
https://onboarding.silverleaf.co.tz/en
https://onboarding.silverleaf.co.tz/en/bio
https://onboarding.silverleaf.co.tz/en/sign-off
https://onboarding.silverleaf.co.tz/en/feedback
https://onboarding.silverleaf.co.tz/en/admin/members
https://onboarding.silverleaf.co.tz/en/admin/hiring
https://onboarding.silverleaf.co.tz/en/admin/sla-bot
https://onboarding.silverleaf.co.tz/en/admin/sections
https://onboarding.silverleaf.co.tz/en/admin/materials
```
