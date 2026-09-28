# Hackathon Kanban Board — Design Spec

## Overview

A projector-optimised Kanban board for the hackathon team. State lives in `kanban.json` (committed to repo). The React page at `/kanban` imports the file; Vite HMR auto-refreshes the projector on every change. Drag-and-drop calls a single Express route that writes back to the file.

## Architecture

```
kanban.json  ←──────────────────────────────────┐
     │                                           │
     │  imported by Vite (HMR)                  │ POST /api/kanban
     ▼                                           │  (writes file)
React /kanban page ──── drag drop ──── Express server (already running)
     │
     └── open on projector at localhost:5173/kanban
```

## Columns

Fixed set — no configuration needed:
1. **Ideas** (purple accent)
2. **In Progress** (orange accent)
3. **Done** (green accent)

## Data Model — `kanban.json`

```json
{
  "columns": ["ideas", "in-progress", "done"],
  "cards": [
    {
      "id": "1",
      "title": "Build a quiz game",
      "column": "ideas",
      "owner": "@kit",
      "tag": { "label": "UX", "color": "purple" }
    }
  ]
}
```

- `owner` and `tag` are optional per card
- `tag.color` is one of: `purple`, `cyan`, `green`, `orange`, `red`
- `id` is a unique string (timestamp or short uuid)

## Visual Style

- Dark background (`#1a1a2e`) — eliminates projector glare
- Large readable cards with thick column color accent at top
- Cards: title (large) + tag pill (colour-coded) + `@owner` label
- Column header shows column name + card count

## Components

### `client/src/pages/Kanban.jsx`

- Fetches initial state from imported `kanban.json`
- Renders three `<Column>` components
- Uses `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop
- On `DragEndEvent`: moves card in local state, calls `POST /api/kanban` with full new state

### `client/src/pages/Kanban.css`

- Dark projector styles
- Column layout: flexbox row, equal-width columns
- Card: `background:#16213e`, border-radius, large font

### `server/routes/kanban.js`

Single route:
```
POST /api/kanban
Body: { cards: [...] }
Action: writes kanban.json at repo root
Response: { ok: true }
```

## Files

| File | Action |
|---|---|
| `kanban.json` | Create — initial board state with a few sample cards |
| `client/src/pages/Kanban.jsx` | Create — board page |
| `client/src/pages/Kanban.css` | Create — dark projector styles |
| `client/src/App.jsx` | Edit — add `/kanban` route |
| `server/routes/kanban.js` | Create — file-write endpoint |
| `server/index.js` | Edit — mount kanban route |

## Client Dependencies

Add to `client/package.json`:
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

## Constraints

- No auth on the `/kanban` page or the API route — internal hackathon tool only
- No card creation UI — cards are added by editing `kanban.json` directly (Vite HMR updates the projector instantly)
- No persistence beyond the file — if the server restarts, state is whatever is in `kanban.json`
