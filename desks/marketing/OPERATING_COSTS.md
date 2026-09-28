# What Silverleaf still needs to pay for this app to work

**Audience:** finance / operations  
**App:** Marketing + student-experience platform (live at [sla-marketing-web.vercel.app](https://sla-marketing-web.vercel.app), API at [sla-marketing-api.vercel.app](https://sla-marketing-api.vercel.app))  
**Prices checked:** 14 September 2026  
**TZS conversion:** Bank of Tanzania indicative mid-rate **1 USD = TZS 2,638.16** on 13 Sep 2026 ([BOT exchange rates](https://www.bot.go.tz/exchangerate/excrates)). Reconfirm the day you pay.

This is **not a quote from the vendors**. Click the confirm link on each line and pay the amount shown in *their* checkout. Quote-only items (Ed Admin) must come from the school’s existing Ed-admin contract.

---

## Bottom line

The code is already deployed. What is left is **hosting that is allowed for a school business**, a **database that does not pause**, and the **school systems the app is built to talk to** (Ed Admin, Buffer, email, SMS/WhatsApp).

| Scenario | Monthly | Year 1 (12 months + one-offs) | When to use it |
| --- | ---: | ---: | --- |
| **A. Remaining hosting only** (Ed Admin, Buffer, Google Workspace already paid by the school) | **USD 45** ≈ TZS 118,700 | **USD 540** ≈ TZS 1.42m | Most likely if Silverleaf already uses Ed Admin + Buffer + staff Gmail |
| **B. A + Buffer Essentials for 4 channels** (Instagram, Facebook, TikTok, LinkedIn) | **USD 69** ≈ TZS 182,000 | **USD 828** ≈ TZS 2.18m | If marketing does not already pay Buffer |
| **C. B + WhatsApp Business via Africa’s Talking** | **USD 119** ≈ TZS 314,000 | **USD 1,513** ≈ TZS 4.00m (includes **USD 85** WhatsApp setup) | If parents should get WhatsApp, not only SMS |
| SMS airtime (usage, not a subscription) | TZS **20** per SMS | Budget TZS **50,000–200,000** to start | Tour / interview / form reminders |

**Do not buy:** a new GitHub Team plan, a second database, a second website host, Cursor, Twilio, SendGrid, or a new `.co.tz` domain. Those are either already covered or not required for this app.

---

## 1. Remaining payments that keep the live app up

These two are the items this codebase **depends on every day**. If they stay on free “hobby” tiers, the school site can pause, hit a commercial-use block, or lose nightly jobs (Ed Admin sync, Buffer sync, form reminders).

### 1.1 Vercel Pro — hosts the website and the API

| | |
| --- | --- |
| **Why pay** | The app is two production projects on Vercel: the staff/CEO web app and the Express API. Vercel also runs the six nightly jobs (`stale-leads`, `dead-leads`, `form-reminders`, `edadmin-sync`, `buffer-sync`, `drug-expiry`). Hobby is **personal / non-commercial only**. A school admissions product used by paid staff is commercial use. Pro also includes **USD 20** of usage credit, so a school of this size usually stays at the platform fee. |
| **Official price** | **USD 20 / month** for the team (1 deploying seat included). Extra deploying seats **USD 20 / month** each. Usage beyond the included credit is pay-as-you-go. |
| **TZS (indicative)** | ≈ **TZS 52,800 / month** |
| **Confirm and pay** | [vercel.com/pricing](https://vercel.com/pricing) · [Pro plan docs](https://vercel.com/docs/plans/pro-plan) · [Fair use / commercial](https://vercel.com/docs/limits/fair-use-guidelines) · Dashboard: [vercel.com/dashboard](https://vercel.com/dashboard) |
| **Who logs in** | The Vercel team that owns `sla-marketing-web` and `sla-marketing-api` (org `mourinekitilimourine-8096s-projects`) |
| **What happens if you skip** | Live URLs can be paused or limited; crons are less reliable; commercial use of Hobby is against Vercel’s rules. |

One Pro team covers **both** projects. You do not pay USD 20 twice.

### 1.2 Supabase Pro — database, file uploads, live updates

| | |
| --- | --- |
| **Why pay** | Postgres is where leads, users, campuses, campaigns, and feedback live (already >1,000 active leads). Storage buckets hold admission-form files and walkthrough photos. Free plan: **500 MB** database, **pauses after 1 week of inactivity**, **no daily backups**. That is not safe for admissions. Pro: database stays up, **8 GB** disk, **100 GB** files, **7-day backups**, **USD 10** compute credit (covers the default Micro instance). |
| **Official price** | **USD 25 / month** per organization (typical bill with one Micro project and the spend cap on). Larger compute is extra if the dashboard shows CPU saturation. |
| **TZS (indicative)** | ≈ **TZS 66,000 / month** |
| **Confirm and pay** | [supabase.com/pricing](https://supabase.com/pricing) · Project: [supabase.com/dashboard](https://supabase.com/dashboard) (this repo’s example project URL is `https://bchmzcrsimrrfxmnclik.supabase.co`) |
| **Who logs in** | Whoever holds the Silverleaf Supabase org |
| **What happens if you skip** | The API cannot store leads; the project can pause; file upload and realtime no-op without keys, and Free has no proper backups. |

---

## 2. School systems the app is built around (often already paid)

These are not “new SaaS for the developer.” They are **Silverleaf’s existing tools**. Finance should confirm the current invoices, then only pay **if the API / extra module is not already in the contract**.

### 2.1 Ed Admin (Ed-admin / ed-space) — student information system

The app does **not** replace Ed Admin. After interview pass it sends parents to:

`https://silverleafacademy.ed-space.net/onlineapplication.cfm?ref=<lead_id>`

It also:

- reads **Parents** and **Students** (`/api/general/v1/Parents`, `/api/general/v1/Students`) for the Families screen and sibling checks
- syncs occupancy by grade
- expects Ed Admin to call our webhooks: application submitted, enrolment confirmed, **payment confirmed**

| | |
| --- | --- |
| **Why you need it** | Ed Admin is the official SIS: online application, enrolment, and **fees/payment**. Without the General API key, Families stays empty and sibling checks are skipped. Without webhooks, a paid admission in Ed Admin never becomes “Admission paid” in this app. |
| **Official price** | **Not published.** Ed-admin sells **annual licences by quotation**. Silverleaf already has a live tenant (`silverleafacademy.ed-space.net`), so the school is almost certainly **already paying** the SIS licence. The remaining item is usually **activate Website / General API** via a Client Portal ticket — that may be included or a line on the annual invoice. **Ask Ed-admin / the school’s Ed Admin account manager for the 2026 invoice and whether “Website API / General API” is on it.** |
| **Confirm** | Product: [ed-admin.com/products/ed-admin-learning](https://www.ed-admin.com/products/ed-admin-learning) · Integrations: [ed-admin.com/products/integrations](https://www.ed-admin.com/products/integrations/) · Silverleaf login: [silverleafacademy.ed-space.net](https://silverleafacademy.ed-space.net) · Marketing site: [edadminwebsite.ed-space.net](https://edadminwebsite.ed-space.net/) |
| **What we still need from Ed Admin (work, not always money)** | 1) General API key → paste as `EDADMIN_API_KEY` on Vercel. 2) Same webhook secret we set as `EDADMIN_WEBHOOK_SECRET` / `WEBHOOK_SECRET`, sent as `Authorization: Bearer …` or `X-Webhook-Secret`. 3) Proof of one `application-submitted` and one `payment-confirmed` on production. |
| **What happens if you skip** | Staff can still run the funnel. They cannot see enrolled siblings, occupancy, or automatic “admission paid” from Finance. |

### 2.2 Buffer — social publishing + the dashboard KPI tile

Marketing already tracks Instagram, Facebook, TikTok, and LinkedIn in the 2026 workbook. The app **pulls** follower/post metrics with a Buffer **personal API key**. It does not post for you; staff still publish in Buffer.

| | |
| --- | --- |
| **Why pay** | Without Buffer, the “Buffer social” tile on Dashboard/Analytics stays empty and nightly `/api/cron/buffer-sync` no-ops. Publishing itself also lives in Buffer. |
| **Official price** | API access is **included on every Buffer plan, including Free**. Free: 1 API key, 3,000 requests / 30 days (enough for our nightly sync). **Essentials: USD 6 / channel / month** (USD 5 / channel if billed yearly). **Team: USD 12 / channel / month**. Four channels on Essentials monthly = **USD 24 / month**. If Silverleaf **already** pays Buffer to schedule posts, you only create an API key — **USD 0 extra**. |
| **TZS (indicative)** | 4 × Essentials ≈ **TZS 63,300 / month** if you must start a new paid Buffer. |
| **Confirm and pay** | [buffer.com/pricing](https://buffer.com/pricing) · API keys: [developers.buffer.com](https://developers.buffer.com) · [API on every plan](https://support.buffer.com/article/859-does-buffer-have-an-api) · Create key: Buffer → Account → API settings |
| **Paste into Vercel (API project)** | `BUFFER_API_KEY` (optional `BUFFER_ORGANIZATION_ID`) |
| **What happens if you skip** | Leads and Ed Admin still work. Social KPIs on the dashboard do not. |

### 2.3 Google Workspace / SMTP — parent and staff email

The API sends email through SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`). The intended mailbox is `noreply@silverleaf.co.tz` (or any Workspace mailbox with 2-step verification + an **App password**).

| | |
| --- | --- |
| **Why pay** | Form-reminder cron, interview/tour messages, and “approve then send” agent emails need a real mailbox. Until SMTP is set, those sends are logged as skipped. |
| **Official price** | If Silverleaf **already** has Google Workspace: **USD 0 extra** for one app password on an existing user. A **new** user: Business Starter **USD 8.40 / user / month** flexible, or **USD 7 / user / month** on the annual plan ([Workspace pricing](https://workspace.google.com/pricing), [Google’s published rates](https://knowledge.workspace.google.com/admin/billing/understand-google-workspace-bills-and-charges)). |
| **Confirm** | [admin.google.com](https://admin.google.com) · [App passwords](https://support.google.com/accounts/answer/185833) |
| **What happens if you skip** | App stays up. Parents do not get email. |

---

## 3. Messaging to parents (pay-as-you-go + optional WhatsApp)

The agent loop and reminder jobs send **WhatsApp, else SMS, else email**. Africa’s Talking is the provider wired in code (`AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`, `AT_WA_NUMBER`).

### 3.1 SMS (required for real texts)

| | |
| --- | --- |
| **Why pay** | Tanzania parents are reached fastest by SMS when WhatsApp is not on. Interview, tour, and form-reminder flows call Africa’s Talking. |
| **Official price** | **TZS 20 per SMS** on Vodacom, Airtel, Yas/Tigo, Halotel, Zantel, TTCL for monthly spend under TZS 499,999. TZS **19** per SMS from TZS 500,000 spend. One SMS = 160 characters (70 if special characters). There is **no monthly platform fee** for bulk SMS; you **prepay** the wallet. Alphanumeric sender ID `Silverleaf` must be registered per operator; Tanzania registration is **typically no fee**, 2–4 weeks. |
| **Worked examples** | 500 SMS ≈ TZS 10,000 · 2,500 SMS ≈ TZS 50,000 · 5,000 SMS ≈ TZS 100,000 · 10,000 SMS ≈ TZS 200,000 |
| **Confirm and pay** | Tanzania SMS table: [africastalking.com/sms/bulksms](https://africastalking.com/sms/bulksms) · Country pricing: [africastalking.co.tz/pricing](https://africastalking.co.tz/pricing) · Create account / load wallet: [account.africastalking.com](https://account.africastalking.com/) · TZ sales: tzsales@africastalking.com |
| **Suggested first load** | **TZS 50,000–100,000** (about 2,500–5,000 messages) while you register the sender ID. |
| **What happens if you skip** | App works. Texts are not sent (`dev — no AT` behaviour). |

### 3.2 WhatsApp via Africa’s Talking (optional but intended)

| | |
| --- | --- |
| **Why pay** | The product copy and agent drafts are WhatsApp-first. AT Chat API needs a WhatsApp Business number on their platform. |
| **Official price** | **USD 85** one-time setup + **USD 50 / month** maintenance. Then Meta rates billed through AT for “Rest of Africa”: marketing **USD 0.032**, utility/authentication **USD 0.008**, service **USD 0.002** per message. |
| **TZS (indicative)** | Setup ≈ TZS 224,000 · monthly ≈ TZS 132,000 · plus per-message |
| **Confirm and pay** | [africastalking.co.tz/chat](https://africastalking.co.tz/chat) |
| **What happens if you skip** | SMS + email still cover parents. Set `AT_WA_NUMBER` later. |

---

## 4. Already in place — do not buy again

| Item | Status | Confirm |
| --- | --- | --- |
| App + API hosting (the deployments) | Live on Vercel | [sla-marketing-web.vercel.app](https://sla-marketing-web.vercel.app) |
| Public website `silverleaf.co.tz` | Separate (Wix). This app only needs CORS to that origin. Domain renewal is the **existing** school domain bill, not a new product. | [silverleaf.co.tz](https://silverleaf.co.tz) |
| GitHub private repo | `kitili/SLA-Marketing-S.E` — GitHub Free is enough | [github.com/pricing](https://github.com/pricing) |
| SSL certificates | Included on Vercel | — |
| Custom `*.vercel.app` URLs | Included | — |
| JWT / webhook / cron secrets | Generated; **USD 0** | Set in Vercel env, not a purchase |
| Cursor / developer tools | Not required for production | — |

---

## 5. Recommended purchase order

1. **Vercel Pro (USD 20)** — so production hosting is legitimate and crons stay on. Confirm: [vercel.com/pricing](https://vercel.com/pricing).  
2. **Supabase Pro (USD 25)** — so the database cannot pause and backups exist. Confirm: [supabase.com/pricing](https://supabase.com/pricing).  
3. **Ed Admin** — ask the account manager for the current annual licence + API activation (quote). Portal: [silverleafacademy.ed-space.net](https://silverleafacademy.ed-space.net).  
4. **Buffer API key** — free if Buffer is already paid; otherwise Essentials × number of channels. [buffer.com/pricing](https://buffer.com/pricing).  
5. **SMTP app password** on existing Workspace — usually USD 0. [admin.google.com](https://admin.google.com).  
6. **Africa’s Talking SMS wallet** — TZS 50,000–100,000 to start. [africastalking.com/sms/bulksms](https://africastalking.com/sms/bulksms).  
7. **WhatsApp (USD 85 + USD 50/month)** only if marketing wants WhatsApp this term. [africastalking.co.tz/chat](https://africastalking.co.tz/chat).

---

## 6. Checklist to give finance

- [ ] Vercel invoice: Pro **USD 20 / month** (one team, two projects)  
- [ ] Supabase invoice: Pro **USD 25 / month**  
- [ ] Ed-admin: copy of current annual licence; written yes/no on General / Website API  
- [ ] Buffer: copy of current plan; channel count; or new Essentials quote  
- [ ] Google Workspace: confirm `noreply@silverleaf.co.tz` (or named mailbox) exists  
- [ ] Africa’s Talking: prepaid SMS TZS ______ ; WhatsApp yes/no  
- [ ] After paying: paste keys into **Vercel → sla-marketing-api → Settings → Environment Variables** (`DATABASE_URL`, `SUPABASE_*`, `EDADMIN_API_KEY`, `BUFFER_API_KEY`, `SMTP_*`, `AT_*`, `FRONTEND_URL`, `WEBHOOK_SECRET`, `CRON_SECRET`)

---

## Sources (open these to confirm)

| Vendor | What to check | URL |
| --- | --- | --- |
| Vercel | Pro USD 20, commercial vs Hobby | https://vercel.com/pricing |
| Vercel | Fair use | https://vercel.com/docs/limits/fair-use-guidelines |
| Supabase | Pro USD 25, Free pause rules | https://supabase.com/pricing |
| Buffer | Per-channel USD 6 / 12, API included | https://buffer.com/pricing |
| Buffer API | Create personal key | https://developers.buffer.com |
| Ed-admin | Licence is quote-based | https://www.ed-admin.com/products/ed-admin-learning |
| Ed-admin API | Activate via Client Portal | https://www.ed-admin.com/products/integrations/ |
| Silverleaf Ed Admin | Live SIS | https://silverleafacademy.ed-space.net |
| Africa’s Talking SMS TZ | TZS 20 / SMS | https://africastalking.com/sms/bulksms |
| Africa’s Talking WhatsApp | USD 85 + USD 50/mo | https://africastalking.co.tz/chat |
| Google Workspace | USD 7–8.40 / user | https://workspace.google.com/pricing |
| Bank of Tanzania | USD/TZS | https://www.bot.go.tz/exchangerate/excrates |
| GitHub | Free private repos | https://github.com/pricing |

If a checkout page disagrees with this sheet, **pay the checkout page**. Vendors change list prices without notice.
