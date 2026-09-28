# Critical manual tasks (Silverleaf)

Branch ready locally: `fix/security-and-ops-hardening`  
Automated security tests: **11/11 passing** (`cd backend && npm run test:security`)

Code hardening for this branch is complete. Everything below must be done by a human with access to GitHub / Supabase / Google Workspace / Africa’s Talking / Ed Admin.

---

## 0) Push this branch to GitHub (blocked until you add a remote)

This repo has **no `origin` remote** yet (it was initialized locally). Pull/push cannot run until you add one.

### Option A — existing empty GitHub repo
1. Create a repo on GitHub (or open an existing empty one).
2. In the project folder:

```bash
cd ~/Documents/marketing-and-student-experience-main
git remote add origin https://github.com/<ORG_OR_USER>/<REPO>.git
# or SSH:
# git remote add origin git@github.com:<ORG_OR_USER>/<REPO>.git

git fetch origin
# If remote already has a main branch with history you care about:
# git pull origin main --allow-unrelated-histories   # only if needed; resolve carefully

git push -u origin fix/security-and-ops-hardening
```

3. Open a PR into `main` on GitHub.

### Option B — brand new repo from this machine
```bash
# after installing/auth'ing GitHub CLI:
gh auth login
gh repo create <ORG_OR_USER>/silverleaf-v3 --private --source=. --remote=origin --push
git push -u origin fix/security-and-ops-hardening
gh pr create --base main --head fix/security-and-ops-hardening \
  --title "Security and ops hardening" \
  --body "Webhook auth, role gates, password enforcement, campus IDOR fixes, login rate limit."
```

Paste the repo URL to the agent if you want this done for you.

---

## 1) Rotate the database password (critical)

The Supabase DB password was shared in chat. Treat it as compromised.

1. Supabase dashboard → **Project Settings → Database** → reset database password.
2. Update local `backend/.env` `DATABASE_URL` with the new password (URL-encode special chars, e.g. `@` → `%40`).
3. Update the same `DATABASE_URL` in **Vercel** (or wherever you deploy).
4. Restart the API.

---

## 2) Add Supabase API keys (critical for uploads + realtime)

1. Supabase → **Project Settings → API**
2. Copy:
   - **service_role** → `backend/.env` as `SUPABASE_SERVICE_ROLE_KEY`
   - **anon/public** → `frontend/.env` as `VITE_SUPABASE_ANON_KEY`
3. Confirm `SUPABASE_URL` / `VITE_SUPABASE_URL` match the project URL.
4. Restart backend + frontend.
5. In Supabase Storage, ensure buckets exist (private):
   - `admission-forms`
   - `walkthrough-photos`

Without these, login/API work, but file upload and live UI updates will not.

---

## 3) Configure webhook secrets (Ed Admin)

1. Generate a long random string, e.g.:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Set in `backend/.env` (and Vercel):
   - `WEBHOOK_SECRET=...`
   - optionally `EDADMIN_WEBHOOK_SECRET=...`
3. Give the same secret to Ed Admin to send as:
   - `Authorization: Bearer <secret>` **or**
   - `X-Webhook-Secret: <secret>`
4. Confirm `CRON_SECRET` is set (cron routes fail closed if missing).

Endpoints now protected:
- `POST /api/webhooks/edadmin/application-submitted`
- `POST /api/webhooks/edadmin/enrolment-confirmed`
- `POST /api/webhooks/edadmin/payment-confirmed`
- `POST /api/webhooks/buffer` (optional inbound; `/api/webhooks/puffer` alias)

---

## 3b) Buffer.com — Silverleaf social (not a consumer app key)

Silverleaf publishes social from Buffer. This app **pulls** channels and post metrics via Buffer's GraphQL API.

1. In Buffer: **Account → API settings** → create a **personal API key**  
   (see https://developers.buffer.com). Do **not** paste a Buffer consumer/OAuth app key.
2. Set in `backend/.env` (and Vercel):
   - `BUFFER_API_KEY=...`
   - optionally `BUFFER_ORGANIZATION_ID=...` if the key can see more than one org
3. On the Marketing dashboard, click **Sync from Buffer**. Nightly cron is `/api/cron/buffer-sync` (06:15 UTC).

---

## 4) Email (SMTP) — needed for real parent/staff email

App passwords for Gmail/Google Workspace require an **org admin** change if the user is only a member.

### Preferred
1. Admin creates/uses `noreply@silverleaf.co.tz`
2. Enable **2-Step Verification** for that mailbox
3. Generate an **App password**
4. Set in `backend/.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=noreply@silverleaf.co.tz
   SMTP_PASS=<16-char-app-password>
   ```

### Alternative (no Google admin needed)
Use Brevo / Resend / SendGrid SMTP and point `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` at that provider.

Until this is set, the app still runs; emails log as “dev — no SMTP”.

---

## 5) SMS / WhatsApp (Africa’s Talking) — needed for real texts

1. Log into Africa’s Talking → copy API key + username.
2. Set in `backend/.env`:
   ```env
   AT_API_KEY=...
   AT_USERNAME=...
   AT_SENDER_ID=Silverleaf
   AT_WA_NUMBER=...   # optional; if missing, WhatsApp falls back to SMS when a phone exists
   ```
3. Restart API.
4. Send a test interview/tour message to a real phone.

---

## 6) Frontend URL + production CORS

In production env:
```env
FRONTEND_URL=https://your-frontend-domain
NODE_ENV=production
```
Missing `FRONTEND_URL` in production rejects browser origins (by design after hardening).

---

## 7) Local UI smoke (you can do now)

Servers (when running):
- Frontend: http://127.0.0.1:3000
- API: http://127.0.0.1:5000

```bash
cd backend && npm run dev
cd frontend && npm run dev -- --host 127.0.0.1 --port 3000
```

Login:
- Email: `marketing@silverleaf.co.tz`
- Password: `TestPass123!`  
  (this was set during local smoke testing; change it again if you prefer)

Walk through: Marketing dashboard → Leads → one lead detail → try opening Dispensary with that account (should be blocked).

---

## Priority order

1. Rotate DB password  
2. Add GitHub remote → push branch → open PR  
3. Supabase service/anon keys + storage buckets  
4. `WEBHOOK_SECRET` + `CRON_SECRET` in deploy env  
5. SMTP (admin app password or third-party)  
6. Africa’s Talking for SMS  
7. Wire Ed Admin with the webhook secret; paste `BUFFER_API_KEY` for social 

Nothing else critical is left in application code for this hardening branch.
