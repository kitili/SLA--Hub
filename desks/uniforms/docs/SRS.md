# Software Requirements Specification (SRS)

**Product:** Silverleaf Uniform Tracker (`silverleaf-uniforms`)  
**Vision:** One system for tailoring, two warehouses, distribution to five campuses, parent orders (FIFO), payments, POs, and cost/revenue — replacing Google Sheets / Excel.  
**Version:** 1.0 (meeting + workbook baseline)  
**Date:** 2026-08-26  

Sources:

- Process meeting (Paul; construction: Mourine, Geoffrey, Irene; Nelly on parent/FIFO)
- [source/uniform-tracker-system-map.png](./source/uniform-tracker-system-map.png)
- [source/SLA Uniform Master Sheet.xlsx](./source/SLA%20Uniform%20Master%20Sheet.xlsx)
- [source/2026 Uniform Analysis.xlsx](./source/2026%20Uniform%20Analysis.xlsx)
- Diagram pack (roles, ERD, workflows): [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Introduction

### 1.1 Purpose

Define the **complete** uniform operations system. Leadership decided not to start with a thin inventory-only slice.

### 1.2 Scope

| # | Module | Excel / meeting origin |
|---|--------|------------------------|
| M1 | Platform & roles | System map: Imani, Loveness, finance, campus staff |
| M2 | Campuses & warehouses | Five campuses; main warehouse + Usa River shop |
| M3 | Catalogue | Master: Parent Order Form, Uniform Catalogue |
| M4 | Stock ledger | Master inventory + 2026 size breakdown |
| M5 | Parent portal & FIFO | Nelly: order then pay; first come, first served |
| M6 | Payments & profit | 2026 Summary buy/sell/profit; uniform account / Lipa / cash |
| M7 | Campus requests | Admins (Usa, AM) vs head teachers (Kijenge, Boma, Ilboru) |
| M8 | Distribution & DNs | Imani initiates all campus issues; DN sheet |
| M9 | Purchase orders | City purchases received at Usa River / main first |
| M10 | Demand & size analytics | Managers see hottest sizes for next bulk buy |
| M11 | Sewing / production | Loveness; 2026 Daily tracker + Sewed Uniform Order |
| M12 | Printables | Coupon, delivery note, parent order form |

### 1.3 Definitions

- **Main warehouse** — first landing for city-bought stock and sewn goods; Imani & Loveness.
- **Usa River shop** — school shop warehouse managed by Loveness (Usariva).
- **Coupon** — paid (or entitled) parent order waiting for / partially issued stock.
- **FIFO** — fulfilment order is `orderedAt` ascending, not payment date, not who shouts first.
- **Mbegu campuses** — Kijenge, Boma, Ilboru (head teacher requests).
- **Registration number** — student unique ID (e.g. `SLA/UR/2023/312`) used to pull class and gender.

---

## 2. Overall description

### 2.1 Product perspective

Web application (Next.js):

- Staff console (`/(app)`) — role-scoped desks
- Parent portal (`/(parent)`)
- Print views (`/(print)`)
- SQLite in development; PostgreSQL before production load

### 2.2 User classes

| Role | People / pattern | Primary goals |
|------|------------------|---------------|
| STORE | Imani | Receive into main; run all distribution; see whole network stock |
| TAILOR | Loveness | Sewing jobs; Usa River shop stock |
| FINANCE | Finance desk | Costs, budgets, payments, profit |
| ADMIN | Usa River & Arusha Town (AM) administrators | Request stock for their campus |
| HEAD_TEACHER | Kijenge, Boma, Ilboru | Request stock for their campus |
| PRINCIPAL | Campus / school leadership | Read-only campus view |
| PARENT | Guardian | Place order, pay, see queue position and issue status |

### 2.3 Operating environment

- **Locale:** Tanzania — TZS
- **Campuses (five):** Usa River, Arusha Town (AM / Arusha Modern), Kijenge, Ilboru, Boma
- **Not in v1 campus list:** Kilizona (appears on an older 2026 sheet only)

### 2.4 Constraints

- All city purchases **receive into main warehouse first**, then move to shop or campuses.
- Distribution to campuses is **only** initiated by Imani (central).
- Parent **order precedes payment**. Payment confirmation does not skip the FIFO line.
- Role walls are enforced server-side.
- Amounts stored as integer TZS.

### 2.5 Current process (as briefed)

1. City purchases (e.g. tracksuits) received at Usa River under Imani and Loveness; tailoring also happens there.
2. Two warehouses: main (everything lands first) and Usa River shop (Loveness).
3. Usa River and AM **admins** request new uniforms; Kijenge, Boma, Ilboru **head teachers** request for their sites.
4. Imani distributes from the central store to all five campuses.
5. Team will leave Google Sheets once this system is live.
6. Daily discipline from 2026 notes: coupons and distribution updated the same day.

---

## 3. Functional requirements

### M1 — Platform & roles

| ID | Requirement | Priority |
|----|-------------|----------|
| M1-F01 | Login per desk; deactivate user | P0 |
| M1-F02 | Role × route × action matrix | P0 |
| M1-F03 | Session lasts 7 days; logout | P0 |
| M1-F04 | Audit log on stock, pay, distribute, PO receive | P1 |

### M2 — Campuses & warehouses

| ID | Requirement | Priority |
|----|-------------|----------|
| M2-F01 | Five campuses with codes USA, AM, KIJENGE, ILBORU, BOMA | P0 |
| M2-F02 | Locations: MAIN warehouse, SHOP_USA, plus one store per campus | P0 |
| M2-F03 | User bound to at most one campus (admins / HTs) | P0 |

### M3 — Catalogue

| ID | Requirement | Priority |
|----|-------------|----------|
| M3-F01 | SKUs: sweater, polo, round-neck, tracksuit, girls skirt/trouser, boys trouser | P0 |
| M3-F02 | School vs boarding colourways (navy/light blue/yellow vs grey/red/black) | P0 |
| M3-F03 | Sizes 18–38 plus Small/Medium where used | P0 |
| M3-F04 | Sell price and default buy price per SKU (TZS) | P0 |

Master parent-form SKUs (day): SS1 navy sweater 25,000; PT1 light-blue polo 15,000; RT2 yellow round-neck 10,000; TS1 light-blue tracksuit 30,000; GS1 grey skirt/trouser 30,000; BT1 grey trousers 30,000 (boarding variants in the same sheet).

### M4 — Stock ledger

| ID | Requirement | Priority |
|----|-------------|----------|
| M4-F01 | Qty on hand by location + SKU + size | P0 |
| M4-F02 | Movements: receive, sew-in, transfer, distribute, parent issue, adjust | P0 |
| M4-F03 | Low-stock flag vs reorder point | P1 |
| M4-F04 | Cannot issue more than on-hand | P0 |

### M5 — Parent portal & FIFO

| ID | Requirement | Priority |
|----|-------------|----------|
| M5-F01 | Parent selects items/sizes from catalogue (day vs boarding) | P0 |
| M5-F02 | Order captures date, class, gender, size, student registration number | P0 |
| M5-F03 | Status: ORDERED → PAID → PARTIAL / FULFILLED | P0 |
| M5-F04 | Queue position = count of earlier unpaid-or-unfulfilled orders by `orderedAt` | P0 |
| M5-F05 | Payment is a second step; cannot fulfil unpaid lines | P0 |
| M5-F06 | Optional link: registration number hydrates class and gender | P0 |

### M6 — Payments, expenses, profit

| ID | Requirement | Priority |
|----|-------------|----------|
| M6-F01 | Record payment: amount, channel (cash, Lipa, uniform account), date, ref | P0 |
| M6-F02 | Partial payments; remaining balance on the coupon | P0 |
| M6-F03 | Expense lines: supplier invoices, tailor labour, materials (jora) | P0 |
| M6-F04 | Profit view: sell − buy (and sewing cost) at network and campus | P0 |
| M6-F05 | Term/year budget vs committed POs vs actual receive | P1 |

### M7 — Campus requests

| ID | Requirement | Priority |
|----|-------------|----------|
| M7-F01 | ADMIN may request only for Usa River or AM | P0 |
| M7-F02 | HEAD_TEACHER may request only for Kijenge, Boma, or Ilboru | P0 |
| M7-F03 | Request lines: SKU, size, qty, needed-by date | P0 |
| M7-F04 | STORE (Imani) sees a single queue of open requests | P0 |

### M8 — Distribution

| ID | Requirement | Priority |
|----|-------------|----------|
| M8-F01 | Only STORE creates a distribution / delivery note from MAIN (or shop) to a campus | P0 |
| M8-F02 | Receiver name/sign captured (DN sheet pattern) | P1 |
| M8-F03 | Campus stock increases; source decreases | P0 |
| M8-F04 | Parent issue from campus or shop stock; status Received all / Received few | P0 |

### M9 — Purchase orders

| ID | Requirement | Priority |
|----|-------------|----------|
| M9-F01 | Supplier list (from master pricing sheet) | P1 |
| M9-F02 | PO: SKU, size, qty, unit cost | P0 |
| M9-F03 | Goods receipt **into MAIN** first | P0 |
| M9-F04 | Transfer MAIN → SHOP_USA when stocking the shop | P0 |

### M10 — Size analytics

| ID | Requirement | Priority |
|----|-------------|----------|
| M10-F01 | Issued qty by SKU+size (term and 12 months) | P0 |
| M10-F02 | Manager dashboard: hottest sizes, dead sizes, suggested reorder | P0 |
| M10-F03 | Demand plan: expected enrolment × pack − on-hand = buy qty (2026 OVERALL pattern) | P1 |

### M11 — Sewing

| ID | Requirement | Priority |
|----|-------------|----------|
| M11-F01 | Daily job: date, tailor, type, expected vs actual | P0 |
| M11-F02 | Completing a job increases MAIN (or shop) stock | P0 |
| M11-F03 | Materials (jora) and labour posted as expenses | P1 |

### M12 — Printables

| ID | Requirement | Priority |
|----|-------------|----------|
| M12-F01 | Parent coupon / order form | P1 |
| M12-F02 | Delivery note (issuer, receiver, lines) | P1 |

---

## 4. Non-functional

| ID | Requirement |
|----|-------------|
| N1 | Usable on a school office laptop in the browser |
| N2 | Swahili labels may be added later; v1 UI is English with campus names as used in the sheets |
| N3 | Seed includes 2026-like catalogue prices and a handful of coupons per campus |
| N4 | Docs in `docs/` stay the delivery contract (Shule One pattern) |

---

## 5. Traceability (Excel tabs → modules)

**Master sheet:** Overview → this SRS; Parent Order Form → M3/M5; Catalogue → M3; Order Process → M5/M9; Pricing & Provider → M9; School Order Sheet → M5; Distribution → M8; Inventory → M4.

**2026 analysis:** Summary → M6; DN → M8; OVERALL / USA / AM / ILBORU / KIJENGE → M10; Daily tracker & Sewed Uniform Order → M11; Coupon vs Distribution per campus → M5/M8; STOCK → M4.
