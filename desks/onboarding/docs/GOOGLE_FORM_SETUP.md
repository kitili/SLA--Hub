# Connect Google Form → Hiring board

Form: [Silverleaf Academy - Application Form](https://docs.google.com/forms/d/e/1FAIpQLSfGGePMG4fe8dlH9xN8MU60E3FZfZeA2SRoFSpj5toPrCdQ4Q/viewform)

The webhook only needs **full name + any email**. Missing LinkedIn/CV still appear under Incomplete Application. Duplicate emails are skipped. Trailing spaces and non-breaking spaces on question titles are ignored.

## Backfill rows already on the form

The board does not pull historical responses by itself. Use one of these:

### Option A — Sheet menu (best)

1. Open the linked Google Sheet.
2. **Extensions → Apps Script** and replace the project with [`google-apps-script/FormToHiring.gs`](../google-apps-script/FormToHiring.gs).
3. Set:

```js
var HIRING_WEBHOOK_URL = 'https://onboarding.silverleaf.co.tz/api/hiring/applications';
var HIRING_WEBHOOK_SECRET = '…APPLICATIONS_WEBHOOK_SECRET…';
```

4. Run **installTriggerOnce** (authorize).
5. Run **Hiring Board → Push ALL responses to Hiring (backfill)**. Safe to re-run.

### Option B — CSV

Sheet → **File → Download → CSV**, then **Admin → Hiring → CSV import**, or:

```bash
npm run hiring:import-csv -- ~/Downloads/form-responses.csv
```

Quoted cells with commas or line breaks import as one row.

Do not import older `Master_Hiring_Pipeline_Form_Responses_*.csv` files onto this board — those are a previous Head Teacher / Principal round, not the current Head of Section / Finance openings.
