# Import Majundo Week 1 Gantt into Google Sheets

Files in this folder:
- `Majundo_Week1_Gantt_Tasks.csv` — flat task list (best for filtering / conditional formatting)
- `Majundo_Week1_Gantt_Grid.csv` — person × day Gantt grid

## Steps

1. Open [Google Sheets](https://sheets.google.com) → **Blank spreadsheet**.
2. Name it: **Majundo Ops — Week 1 Gantt**.
3. **File → Import → Upload** → choose `Majundo_Week1_Gantt_Tasks.csv`.
4. Import location: **Replace current sheet**. Separator: **Comma**.
5. Rename that tab to **Tasks**.
6. **File → Import** again → `Majundo_Week1_Gantt_Grid.csv` → **Insert new sheet(s)** → rename to **Gantt**.

## Make the Gantt look like a chart (Tasks tab)

1. Select column **F (Status)**.
2. **Format → Conditional formatting**:
   - Text contains `Done` → green background
   - Text contains `Open` → yellow/orange background
3. Optional: **Data → Create a filter** on the header row.
4. Filter Person = Amos / Jfree / Irene to see remaining work.

## Gantt tab tips

1. Widen columns Day 1–Day 6.
2. Conditional formatting on cells containing `Done` / `Open`.
3. Freeze column A: **View → Freeze → 1 column**.

## Week goal (put in cell A1 of a Notes tab)

Matron can start a trip, scan a student QR, see GPS + fee balance, record time-in/out, and a parent gets SMS/WhatsApp. Admin sees today’s boarding list.

Demos: end of Day 3 and Day 5.
