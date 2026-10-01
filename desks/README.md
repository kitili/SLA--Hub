# Workplace systems in this repository

Every Silverleaf system lives in this one repo, grouped by desk. Live Vercel and Railway sites are unchanged. Hub cards still open the live URLs.

| Lane | Folder | Supabase schema | Live site |
|---|---|---|---|
| CODE | `src/` | `shared` | https://sla-hub-nu.vercel.app |
| OPS | `desks/ops` | `public` | https://ops-transport-system.vercel.app |
| ONBOARDING | `desks/onboarding` | `onboarding` | https://onboarding.silverleaf.co.tz |
| MARKETING | `desks/marketing` | `marketing` | https://sla-marketing-web.vercel.app |
| DATA & TECH | `desks/data-tech` | `data_tech` | https://dataandtech.silverleaf.co.tz |
| TALENT ACADEMY | `desks/talent-academy` | `talent` | https://talent-academy-sla.vercel.app |
| UNIFORMS | `desks/uniforms` | `uniforms` | https://school-uniforms-lyart.vercel.app |
| VISITORS | `desks/visitors` | `visitors` | https://v-isitors.vercel.app |
| WORKBOARD | `desks/workboard-tasks` | `workboard` | https://silverleaf-tasks.vercel.app |
| LESSON PLANS | `desks/lesson-plans` | `lesson_plans` | https://silverleaf-lesson-plans-main.vercel.app |
| MEL | `desks/mel-dashboard` | `mel` | https://silverleafmeldashboard-production.up.railway.app/#overview |

Open `SOURCE.md` in a folder for the snapshot SHA. Do not push a desk folder to that system’s original GitHub repo.

Hub HR **Systems** (`/systems`) is the visual map: each cell is one lane, one folder, one schema.

## One Ops database, labeled lanes

One Supabase project. Ops live data stays in `public`. Every other system has its own schema. The catalog is `shared.systems`. Apply labels with `desks/ops/supabase/LABEL_WORKPLACE_SCHEMAS.sql`.

Do not point hub or onboarding at Ops `public` without `DATABASE_SEARCH_PATH`.
