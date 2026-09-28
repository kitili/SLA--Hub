# Excel import snapshot

The workbooks in this folder are the **import snapshot**, not the live source of truth after go-live.

| File | What we took |
|------|----------------|
| `SLA Uniform Master Sheet.xlsx` | Catalogue names, school vs boarding colourways, sell prices, supplier names, coupon columns (date, class, gender, size, pay date, reg no) |
| `2026 Uniform Analysis.xlsx` | Sample MAIN opening balances by size, campus list, sewing daily-tracker fields, buy vs sell vs profit |

## How that maps to seed (`prisma/seed.ts`)

| Excel idea | Seed / table |
|------------|----------------|
| Parent Order Form SKUs (SS1, PT1, RT2, TS1, GS1, BT1 + boarding) | `Sku` + `SkuSize` (18–38, S/M on tracksuits) |
| Pricing & Provider names | `Supplier` |
| STOCK / size breakdown | `prisma/opening-2026.ts` → leftover on MAIN, shop, and campus stores |
| Coupon sheet | Sample `ParentOrder` + `Payment` + `ParentIssue` |
| Daily sewing tracker | `SewingJob` + `MaterialBatch` |
| Summary budget | `Budget` year 2026, TZS 50,000,000 |

`npm run db:setup` wipes SQLite and reloads this snapshot. Keep Excel until a campus is trained; then the app is the record.

Do **not** treat Kilizona as a sixth campus — it is only on an older sheet.

## Sheet formulas encoded in the app (`src/lib/sheet-math.ts`)

The live `.xlsx` files are **not** imported. The OVERALL / Master arithmetic is implemented in code and drives `/sizes`, `/finance`, and `runForecast`.

| Sheet idea | Formula | App |
|------------|---------|-----|
| Pack per child | Day: PT1×2, SS1×1, RT2×1, TS1×1, GS1×1 (girl), BT1×1 (boy). Boarding: BPT1×2, BSS1/BRT2/BTS1×1 | `SCHOOL_PACK` / `BOARDING_PACK` |
| Required | `enrolment × pack` | `requiredQty` |
| Order qty | `max(0, required − campus − MAIN leftover)` | `orderQty` + `allocateMainCover` |
| Order cost | `orderQty × buyTzs` | `buyCost` |
| Profit | `sell − buy` | `profitTzs` |
| Coupon vs distribution | entitled qty − issued qty | `couponGap` |
| Sewing P&L | city-buy replacement − (jora + labour) | `sewingPnl` |
| Polo buy | TZS 11,000 | `Sku.buyTzs` for PT1 / BPT1 |

Size fit by class (`SizeFit`) maps each class + gender to a size, so required pieces land on the same sizes the parent chart shows. Enrolment rows named `ALL` are split across P1–P6.

Do **not** forecast with `issued × 1.1` or invented size shares. Refresh buy plan writes `SizeForecast` from `loadOverallPlan` only.

MAIN leftover is allocated to campus shortfalls (name order) before city buy. **Draft PO from plan** on `/sizes` writes `PO-PLAN-2027`. Enrolment heads and buy/sell are editable there so the formulas stay live.
