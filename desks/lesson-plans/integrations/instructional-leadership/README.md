# Silverleaf Academy · Instructional Leadership Dashboard

A live web dashboard that combines **campus walkthroughs** and **teacher observations** for Silverleaf Academy's five campuses (Usa River, Arusha Modern, Kijenge, Ilboru and Boma). It is a Google Apps Script web app that reads two Google Sheets every time it loads, so it always reflects the latest Google Form submissions. It follows the Silverleaf Academy Brand Guidelines (March 2023).

Version 2, 27 October 2026.

## What is in this folder

| File | What it does |
|---|---|
| `Code.gs` | Server side. Reads both trackers, works out the figures and sends them to the page. All settings are in the `CONFIG` block at the top. |
| `Index.html` | The dashboard page: Overview, Walkthroughs and Observations tabs, period filters (whole year or by term), tables and charts. |
| `appsscript.json` | Project manifest: time zone (Africa/Dar_es_Salaam), V8 runtime and web app settings. |

## Where the data comes from

| Source | Tabs read |
|---|---|
| [MASTER] Walkthroughs Tracker | `Combined Responses`, `SETUP (Edit Here)` (term dates), `Google Form Setup Guide` (PD focus lists), `DASHBOARD` (campus × term table) |
| [MASTER] 2026 SLA Teacher Observation Tracker | The five campus response tabs, `SETUP (Edit Here)` (teacher roster), `DASHBOARD` (start and end dates) |

The page also shows the Silverleaf brandmark, which it loads from a PNG in Google Drive (`LOGO_FILE_ID`).

## How the figures are worked out

The dashboard uses the trackers' own rules, so its totals match each tracker's DASHBOARD tab.

- **Walkthroughs:** every row in `Combined Responses`, plus any walkthroughs the tracker's "Walkthroughs per campus and term" table counts beyond the form entries. At present that is 35 Term 1A walkthroughs done before the form was in use. Those have no PD focus recorded, so PD focus views use form entries only.
- **Observations (whole year):** form submissions dated between the tracker's start and end dates, plus the tracker's allowance of 6 observations per rostered teacher. Term views count form submissions only.
- **Teachers:** rows on the Observation Tracker's SETUP roster with the Role "Teacher".
- Name spellings are tidied (for example "Grace KAMBONA" and "Grace Kambona" count as one facilitator).

## Setting it up

You need a Google account that can open both trackers and the logo file.

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Rename the project, for example *Silverleaf Instructional Leadership Dashboard*.
3. Replace the contents of `Code.gs` with this folder's `Code.gs`.
4. Click **+** next to *Files* → **HTML**, name it `Index` (capital I, no extension), and paste in `Index.html`.
5. Open **Project Settings** (gear icon) and check the time zone is **(GMT+03:00) East Africa Time**. Optionally tick *Show "appsscript.json" manifest file in editor* and replace it with this folder's `appsscript.json`.
6. If you are using your own copies of the trackers or logo, change `WALKTHROUGH_SHEET_ID`, `OBSERVATION_SHEET_ID` and `LOGO_FILE_ID` in the `CONFIG` block. Each ID is the long code in the file's web address between `/d/` and `/edit`.
7. Click **Save**, then **Deploy → New deployment**. Under *Select type* choose **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone within your organisation (or Only myself while testing)
8. Click **Deploy**, then **Authorize access** and **Allow**. Google asks for permission to read spreadsheets and Drive files, so the dashboard can read the trackers and the logo.
9. Copy the **Web app URL**. That link is the dashboard.

Because it runs as the person who deployed it, viewers do not need access to the trackers themselves, only to the web app link.

## Settings you may want to change (`CONFIG` in Code.gs)

| Setting | Purpose |
|---|---|
| `CAMPUSES` | Campus names as the walkthrough form writes them (`name`) and as the observation SETUP writes them (`full`). The `name` must also match each observation response tab. |
| `OBS_ALLOWANCE_PER_TEACHER` | Observations added per rostered teacher (6, as in the Observation Tracker). |
| `CACHE_MINUTES` | How long figures are reused before the sheets are read again (15). The Refresh button always reads afresh. |
| `TEXT_DATE_ORDER` | How to read dates typed as text: `MDY` or `DMY`. |

## Updating after a change

Edit the files in the script project and save. Then go to **Deploy → Manage deployments**, click the pencil, set **Version** to **New version**, and click **Deploy**. The link stays the same.

## If something goes wrong

- **"The dashboard could not load…":** the account that deployed it cannot open one of the trackers, or a tab was renamed. Check the tab names in `CONFIG` match the sheets exactly.
- **Figures differ from a tracker:** press **Refresh**, since figures can be up to 15 minutes old. Then check whether the tracker's formulas were changed (for example a new manual adjustment).
- **No logo:** the deploying account cannot open the logo file, or `LOGO_FILE_ID` is wrong.
