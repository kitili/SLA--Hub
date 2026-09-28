# Local setup — terminal commands

Copy-paste guide to run **Silverleaf Lesson Plans** on your machine after
unzipping the project. Works on **Mac** and **Linux**.

Requires **Node.js ≥ 22.6**.

---

## 1. Install Node.js 22 (one time)

### Mac — using nvm (recommended)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Close Terminal, open it again, then:

```bash
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
nvm alias default 22
node -v
npm -v
```

You should see `v22.x.x`.

### Mac — using Homebrew (if you already use brew)

```bash
brew install node@22
brew link node@22 --force --overwrite
node -v
```

---

## 2. Go to the project folder

After unzipping:

```bash
cd ~/Downloads/silverleaf-lesson-plans-main
```

Change the path if you extracted the zip somewhere else.

---

## 3. First-time setup (one time per machine)

```bash
npm install
npm run db:seed
```

- `npm install` — downloads dependencies (~1–2 minutes).
- `npm run db:seed` — creates the local database and demo lesson plans.

**Important:** do not run `db:seed` while `npm run dev` is already running.
Stop the dev server first (`Ctrl + C`), then seed.

Optional — load the textbook corpus (slow):

```bash
npm run db:import-textbooks
```

---

## 4. Start the app (every time you work)

```bash
cd ~/Downloads/silverleaf-lesson-plans-main
source ~/.nvm/nvm.sh    # skip if you don't use nvm
nvm use 22              # skip if node -v already shows v22+
npm run dev
```

Wait until you see:

```text
✓ Ready
Local: http://localhost:3000
```

**Keep this Terminal window open.** Closing it stops the server and localhost
will not load.

Open in your browser:

**http://localhost:3000/en/sign-in**

(or **http://localhost:3000** — shows the sign-in screen when logged out)

---

## 5. Sign in (demo — no password)

| Role    | Email                      | Staff ID                          |
| ------- | -------------------------- | --------------------------------- |
| Teacher | `teacher@silverleaf.co.tz` | any non-empty value, e.g. `12345` |
| Admin   | `hr@silverleaf.co.tz`      | any non-empty value, e.g. `12345` |

There is **no password**. Locally, the Staff ID is not checked — only the
email must match a seeded account.

---

## Full copy-paste block (first run)

```bash
source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22
cd ~/Downloads/silverleaf-lesson-plans-main
npm install
npm run db:seed
npm run dev
```

Then open **http://localhost:3000/en/sign-in**.

---

## Every day after that

```bash
cd ~/Downloads/silverleaf-lesson-plans-main
source ~/.nvm/nvm.sh && nvm use 22
npm run dev
```

---

## Troubleshooting

### Browser says “connection failed” or page won’t load

The dev server is not running. Run `npm run dev` and wait for `✓ Ready`.

Check from Terminal:

```bash
curl -I http://localhost:3000
```

If you see `Connection refused`, start the server again.

### `bad option: --experimental-strip-types`

Node is too old. Switch to Node 22:

```bash
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
node -v
```

Then run `npm run db:seed` and `npm run dev` again.

### Port 3000 already in use

Find what is using it (Mac):

```bash
lsof -i :3000
```

Stop that process, or run on another port:

```bash
npm run dev -- -p 3001
```

Then open **http://localhost:3001/en/sign-in**.

### Reset the database

Stop the dev server (`Ctrl + C`), then:

```bash
npm run db:reset
npm run dev
```

### Verify the project (optional)

```bash
npm run typecheck && npm run lint && npm run test
```

---

## Silverleaf staff sign-in (everyone — like onboarding / workboard)

Copy `.env.example` to `.env.local` and set the same values you use for
**onboarding hub** or **workboard tasks**:

```bash
cp .env.example .env.local
```

Required in `.env.local` for real staff (email + ed-admin Staff ID):

- `ED_ADMIN_API_TOKEN` — staff directory bearer token (from IT / onboarding `.env.local`)
- `SESSION_SECRET` — long random string (32+ characters)

Optional: `HR_ADMIN_EMAILS` for `/admin` access.

Restart `npm run dev` after editing `.env.local`.

Without `ED_ADMIN_API_TOKEN`, only the two **seeded demo emails** can sign in
(`teacher@…`, `hr@…`).

## Optional: AI Studio

Add `OPENROUTER_API_KEY` to `.env.local` to enable AI generation locally.

See also: [DEPLOYMENT.md](../DEPLOYMENT.md) · [README.md](../README.md)
