# Silverleaf Visitor Log

Next.js visitor sign-in for Silverleaf Academy campuses: **Usa River**, **Arusha Modern**, **Kijenge**, **Ilboru**, and **Boma**.

No passwords — open the home page and pick your campus dashboard.

- **Front desk** — sign visitors in (name, digits-only phone, purpose, host, optional photo) and sign them out.
- **Self check-in** — visitors scan a campus QR poster and complete the form on their smartphone.
- **History** — full visit history per campus with date range, status, and check-in type filters plus CSV export.
- **Database** — SQLite (`data/visits.db`) with photos stored as files in `data/photos/`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3108](http://localhost:3108) and choose a campus.

For QR codes to work on phones, use your computer’s network address instead of `localhost`, e.g. `http://172.16.10.79:3108`. The QR poster page builds the link automatically. Phone and computer must be on the same Wi‑Fi.

## Campus dashboards

| Campus | Front desk | History | QR posters |
| --- | --- | --- | --- |
| Usa River | `/campus/usa-river` | `/campus/usa-river/history` | `/campus/usa-river/qr` |
| Arusha Modern | `/campus/arusha-modern` | `/campus/arusha-modern/history` | `/campus/arusha-modern/qr` |
| Kijenge | `/campus/kijenge` | `/campus/kijenge/history` | `/campus/kijenge/qr` |
| Ilboru | `/campus/ilboru` | `/campus/ilboru/history` | `/campus/ilboru/qr` |
| Boma | `/campus/boma` | `/campus/boma/history` | `/campus/boma/qr` |

Visitor self check-in (single QR for all campuses): `/check-in`

## Smoke test

```bash
npm run smoke
```
