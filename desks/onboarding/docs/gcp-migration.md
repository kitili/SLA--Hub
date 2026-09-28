# Silverleaf Academy — Moving Off Netpoa, Onto GCP

**Prepared by:** IT (Nehemia)  
**GCP Project:** php-project-487206  
**Status:** Planning draft — not yet started

---

## Contents

1. [Where We Are Now](#1-where-we-are-now)
2. [Why Move to GCP](#2-why-move-to-gcp)
3. [Proposed Architecture (Hybrid)](#3-proposed-architecture-hybrid)
4. [Operational Burden](#4-operational-burden)
5. [Migration Steps](#5-migration-steps)
6. [Cost](#6-cost)
7. [Creating Subdomains in Wix](#7-creating-subdomains-in-wix)
8. [Open Questions Before Starting](#8-open-questions-before-starting)

---

## 1. Where We Are Now

### The recruitment system

| Field      | Details |
|------------|---------|
| Stack      | Raw PHP, no framework — Google Sheet as database |
| Host       | Netpoa shared hosting (personal account, not Silverleaf-owned) |
| URL        | `hiring.nexabie.co.tz` |
| Blocker    | Netpoa intercepts ports 25/465/587 — breaks sending as `jobs@silverleaf.co.tz` via Gmail SMTP. Support ticket in progress, no resolution yet. Workaround via temporary Nexabie mailbox is not a long-term fix. |

**→ Migrate to GCP**

---

### The staff onboarding hub

| Field        | Details |
|--------------|---------|
| Stack        | Next.js 15 (App Router) · TypeScript · full-stack server-rendered |
| Host         | Vercel — `data-and-tech-team` account, GitHub-integrated, auto-deploys on push |
| URL          | `sla-onboarding-hub-tau.vercel.app` (custom `silverleaf.co.tz` subdomain pending) |
| Database     | Neon PostgreSQL — serverless managed cloud, no VM or DB server needed |
| File storage | Vercel Blob — cloud object storage, private + public buckets |
| Auth         | Custom httpOnly session cookie, HMAC-signed with `SESSION_SECRET` |
| Integrations | ed-admin staff directory API (`ED_ADMIN_API_TOKEN`) for sign-in verification |
| Email        | None — no SMTP dependency, no Netpoa exposure |
| Repo         | `github.com/kitili/SLA-Onboarding-hub` |

**→ Stay on Vercel**

> **Recommendation:** This system should not move to GCP. It is a Next.js application built for the Vercel serverless platform — the same company maintains both. Running it on a GCP VM as `next start` would lose edge middleware, incremental static regeneration, and zero-config deployments, while adding VM maintenance overhead. Its database (Neon) and file storage (Vercel Blob) are independent cloud services accessible from anywhere. The correct migration action here is to point a `silverleaf.co.tz` subdomain CNAME at Vercel and set the custom domain in the Vercel project settings — no code or infrastructure changes needed.

---

### The other 3+ systems

Not yet inventoried. Before a real migration plan can be written for them, we need:

- What each one does and how much traffic it gets
- Where each currently runs (shared hosting? Vercel? something else?)
- Any external dependencies (databases, APIs, cron jobs, etc.)
- Node.js version and framework used for the TypeScript/Node ones

---

### Domain setup

`silverleaf.co.tz` is registered through **Kilihost**, but the nameservers point to **Wix**, which hosts the main school website. All DNS and subdomain changes happen in Wix's domain settings — not in Kilihost, and not in Google Workspace Admin Console (which only manages email/Workspace apps, not web DNS).

Google Workspace (Gmail, Docs) is used for `@silverleaf.co.tz` email. Unconfirmed whether IT currently holds Super Admin on that Workspace account — worth checking at `admin.google.com → Account → Admin roles` before any step that needs domain-level Workspace changes.

---

## 2. Why Move to GCP

1. **Escapes the SMTP restriction entirely.** GCP's default network policy only blocks outbound port 25 — it does not intercept or proxy port 587 the way Netpoa does. Sending as `jobs@silverleaf.co.tz` via Gmail SMTP should work with no special exemption needed (to be confirmed once a VM is up).

2. **Consolidates infrastructure.** Right now, systems are scattered across different personal and third-party hosts. One GCP project, under organisational control, is a cleaner long-term setup than depending on multiple unrelated personal hosting accounts.

3. **A GCP project already exists** (`php-project-487206`, tied to Google Cloud APIs this recruitment system already uses) — no new account to set up, just new resources under it.

> **Open question:** The GCP project is currently under Nehemia's personal Google account, not a Silverleaf-owned one. Decide before building further whether that is acceptable long-term — relevant for billing continuity and admin handover if IT staff ever changes.

---

## 3. Proposed Architecture (Hybrid)

Not every system belongs on GCP. The onboarding hub is purpose-built for Vercel and should stay there. Everything else — the PHP recruitment system and the yet-to-be-inventoried systems — runs on one shared GCP VM fronted by Nginx.

| GCP Compute Engine VM | Vercel (stays as-is) |
|----------------------|----------------------|
| Recruitment / hiring system (PHP) | Staff onboarding hub (Next.js 15) |
| Other systems (PHP or Node — TBD) | Neon PostgreSQL — cloud, no VM needed |
| Nginx reverse proxy (routes by subdomain) | Vercel Blob — cloud, no disk needed |
| Apache + PHP-FPM for PHP systems | Custom subdomain via Wix CNAME record |
| PM2 for Node/TypeScript systems | Auto-deploys from GitHub on push |
| Let's Encrypt SSL (certbot) | |

### GCP VM internal layout

```
                Internet
                   │
            ┌──────┴──────┐
            │    Nginx    │  ← single entry point, routes by subdomain
            └──────┬──────┘
  ┌─────────────────┼────────────────┬─────────────────┐
  │                 │                │                 │
hiring.silverleaf  system2.silverleaf  system3...     system4...
  │                 │                │                 │
Apache + PHP-FPM   Node.js (PM2)    PHP or Node      PHP or Node
(recruitment)      (systemd-managed)
```

Each system keeps its own environment file, its own dependencies, and its own logs — they just share one machine's resources. Less isolation than separate VMs, but dramatically cheaper for a small IT team.

### Connecting the onboarding hub subdomain

No VM or server change needed. The custom domain for the onboarding hub is purely a DNS task:

1. In Wix DNS settings, add a **CNAME record**: host `onboarding` → target `cname.vercel-dns.com`.
2. In the Vercel project settings (data-and-tech-team account), add `onboarding.silverleaf.co.tz` as a custom domain.
3. Vercel provisions the SSL certificate automatically via Let's Encrypt.

Result: `onboarding.silverleaf.co.tz` serves the app via Vercel's global edge network, with automatic HTTPS and zero server management.

---

## 4. Operational Burden

Moving from shared hosting to a self-managed GCP VM means IT takes on responsibilities that Netpoa, Vercel, and Neon currently handle invisibly. These are real ongoing costs — not one-time setup tasks.

### OS, software, and security

Running a public-facing Linux VM means accepting full responsibility for the operating system and everything running on it. These are not optional extras — they are baseline hygiene for any server on the internet.

**OS patching**

The VM runs Ubuntu (or Debian). Security patches for the kernel, glibc, OpenSSL, and the packages installed on it are released continuously. Left unpatched, known vulnerabilities accumulate — and attackers actively scan for them. Someone needs to run `sudo apt update && sudo apt upgrade` on a regular cadence (at minimum monthly), review what changed, and confirm nothing broke. Kernel updates require a reboot, which takes all systems down briefly.

**PHP and Node.js version lifecycle**

PHP and Node.js both have end-of-life schedules. Once a version goes EOL, it stops receiving security patches — running EOL software on a public server is a known risk. The recruitment system will need its PHP version confirmed and tracked. Node.js applications will need their runtime version pinned and updated when the LTS cycle ends.

**Nginx and Apache hardening**

Default installs of Nginx and Apache expose version headers, enable unused modules, and may accept insecure TLS ciphons. Hardening steps include: hiding server version strings, disabling unused modules, enforcing TLS 1.2+, setting security headers (`X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`). None of this is automatic.

**SSH access**

By default, a GCP VM accepts SSH password login from any IP. Minimum hardening before exposing the VM:

- Disable password authentication (`PasswordAuthentication no` in `sshd_config`) — key-based only
- Restrict SSH to known IPs via GCP firewall rules, or use GCP's IAP (Identity-Aware Proxy) so SSH never touches the public internet at all
- Rotate SSH keys if access is shared or a team member leaves

**Firewall and port exposure**

The VM's GCP firewall should only open what's needed: ports 80 (HTTP) and 443 (HTTPS) to the world, port 22 (SSH) to known IPs only. Internal ports (PHP-FPM sockets, Node.js app ports like 3000, 3001) must never be exposed publicly — only Nginx should talk to them, from inside the VM.

**Fail2ban / brute-force protection**

A public IP receives automated login attempts and HTTP attack probes within minutes of being created. Fail2ban monitors logs and auto-bans IPs that repeatedly fail authentication. It is a one-time setup but must be configured and periodically checked to confirm it is still running.

**Dependency vulnerabilities in application code**

PHP's Composer and Node's npm pull in third-party packages. Each package is a potential vulnerability. `composer audit` and `npm audit` surface known CVEs in dependencies — these need to be run periodically and acted on, not ignored.

**Incident response**

On Vercel or Netpoa, when something goes wrong, there is a support channel to contact. On a self-managed VM, IT is the support channel. A compromised server, a full disk, a crashed process at 2am — these all land on whoever owns the VM.

---

### Other VM burdens

| Burden | What it means in practice |
|--------|--------------------------|
| **SSL certificate renewal** | Certbot runs on a cron job. If the cron fails silently, all HTTPS stops working — usually discovered by users, not IT. |
| **Disk & memory monitoring** | No automatic scaling. If a runaway process consumes memory or a log file fills the disk, the VM goes down and takes all systems with it. |
| **Uptime monitoring** | No built-in alerting. IT needs to set up a free external monitor (UptimeRobot, Better Uptime, etc.) to get notified when the VM goes down rather than finding out from staff. |
| **Backups** | No automatic backups by default. Any database or uploaded file on the VM that isn't separately backed up can be permanently lost if the disk fails. |

### Deployment process

Unlike Vercel (git push → auto-deploy), deploying to the GCP VM is manual:

```
SSH into VM → git pull → composer install / npm install → restart service → verify
```

There is no rollback button. If a deployment breaks something, the fix is to SSH back in and revert manually. For a small IT team, this is manageable — but it means every deployment carries more risk than pushing to Vercel.

### Single point of failure

All GCP-hosted systems share one VM. If the VM crashes, reboots, or runs out of disk/memory, all of them go down simultaneously. This is acceptable for internal tools with low traffic, but worth naming explicitly before committing to the design.

### Split operational picture

With this hybrid setup, systems live in two places with different deployment processes, different log locations, and different failure modes:

- **GCP systems:** SSH + journalctl + PM2 logs + Nginx error logs
- **Onboarding hub:** Vercel dashboard + Vercel runtime logs + Neon console

There is no single pane of glass. Debugging an incident requires knowing which system is affected and where to look.

### What stays off IT's plate

The onboarding hub keeping Vercel keeps its zero-maintenance posture: auto-deploys, automatic SSL, edge network, serverless scaling, and Neon handling all database infrastructure. That is a deliberate benefit of the hybrid design — the system that runs the most business logic stays on managed infrastructure.

---

## 5. Migration Steps

### One-time GCP setup

1. Confirm billing is enabled on the GCP project (a card on file is required even to use free-tier resources).
2. Decide on the GCP project's ownership (personal vs. Silverleaf-owned account) before building further.
3. Create the Compute Engine VM: region `us-west1`, `us-central1`, or `us-east1` (eligible for free `e2-micro` tier). Reserve a static external IP. Allow HTTP/HTTPS in firewall settings.
4. SSH in and install the shared stack:
   ```bash
   sudo apt update
   sudo apt install -y nginx apache2 php php-fpm php-curl php-mbstring \
       php-xml composer git nodejs npm certbot python3-certbot-nginx
   sudo npm install -g pm2
   ```

### Per-system migration (repeat for each GCP system)

1. Pull the code onto the VM (`git clone` from each system's repo).
2. **PHP systems:** `composer install`, configure an Apache vhost, recreate `.env`/config with production values, upload any secret files securely.
3. **Node/TypeScript systems:** `npm install`, `npm run build` if applicable, start under PM2 (`pm2 start ... --name system-name` then `pm2 save` + `pm2 startup`).
4. Add an Nginx server block routing that system's subdomain to its local port or socket.
5. Add the DNS A record in Wix (see Section 7).
6. Get an SSL certificate: `certbot --nginx -d subdomain.silverleaf.co.tz`
7. Update the system's own config (base URL, OAuth redirect URIs) to match its new `https://` address.
8. Smoke test before going live. Only decommission the old host once stable on GCP for a reasonable period.

### For the recruitment system specifically

Same steps as any PHP system above, plus:

- Reconnect the Google Calendar/Drive OAuth connection once live on the new domain (redirect URI must match exactly).
- Confirm Gmail SMTP works unrestricted on GCP (this is the whole point of the move) before considering the migration a success.

### For the onboarding hub (Vercel — no GCP work needed)

1. Add the CNAME record in Wix: `onboarding` → `cname.vercel-dns.com`.
2. Add `onboarding.silverleaf.co.tz` as a custom domain in the Vercel project (data-and-tech-team account → Project Settings → Domains).
3. Verify SSL is provisioned by Vercel (automatic, usually under 2 minutes).
4. Update the `ED_ADMIN_STAFF_API_URL` env var in Vercel if the ed-admin base URL changes.

---

## 5. Cost

| Item | Expected cost |
|------|---------------|
| First `e2-micro` VM (if it covers everything) | **Free** — Always Free tier, in an eligible region |
| Realistic sizing for 4+ systems (`e2-small` / `e2-medium`) | **~$13–30/month** — depends on actual combined load (not yet known) |
| Static external IP | Free while attached to a running instance |
| Persistent disk (30 GB free allowance) | Likely free; extra disk ~$0.04/GB-month |
| Network egress | Free up to 1 GB/month (North America); realistic for low-traffic tools |
| SSL certificates | Free — Let's Encrypt via certbot |
| Domain / subdomains | Free — `silverleaf.co.tz` already owned; subdomains cost nothing extra |
| Onboarding hub — Vercel | Free tier (current usage well within limits); Neon and Vercel Blob also on free tiers |

> **Action: set a billing alert immediately.** Set a billing budget alert in the GCP console (free, 2-minute setup) as soon as the first resource is created. Catches unexpected costs before month-end — especially important if VM sizing needs to change once all systems are running.

---

## 6. Creating Subdomains in Wix

Since `silverleaf.co.tz`'s nameservers point to Wix, all DNS changes happen in Wix's domain settings — not in Kilihost, and not in Google Workspace Admin Console.

### For GCP-hosted systems — A record

1. Log into the Wix account that manages `silverleaf.co.tz`.
2. Go to **Domains** → select `silverleaf.co.tz` → **DNS Records** (sometimes under "Advanced" or "Manage DNS").
3. Add an **A record**: host = subdomain prefix only (e.g. `hiring`), points to = GCP VM static external IP, TTL = default.
4. Repeat once per GCP-hosted subdomain — all A records point at the same VM IP; Nginx sorts out which system gets each request by hostname.
5. Verify propagation before requesting SSL: `dig subdomain.silverleaf.co.tz +short` should return the VM's IP.

### For the onboarding hub — CNAME record

1. Add a **CNAME record**: host = `onboarding`, points to = `cname.vercel-dns.com`, TTL = default.
2. Add the custom domain in Vercel project settings. SSL provisions automatically — no certbot step needed.

---

## 7. Open Questions Before Starting

- [ ] Details on the other 3+ systems (stack, current host, traffic, dependencies) — needed to size the VM correctly and plan each migration.
- [ ] Should the GCP project move to a Silverleaf-owned account rather than staying under IT's personal one?
- [ ] Who has Google Workspace Super Admin, and is that relevant to anything beyond DNS (which is a Wix task, not a Workspace one)?
- [ ] Who has access to the Wix account to make DNS changes?
- [ ] Should the Netpoa SMTP ticket still be pursued in parallel, or dropped once GCP is confirmed working?
- [ ] Which subdomain should the onboarding hub use? (`onboarding.silverleaf.co.tz`, `hub.silverleaf.co.tz`, or another?) — needed before the CNAME record can be created.
- [ ] Is the ed-admin API URL expected to change? If so, update the `ED_ADMIN_STAFF_API_URL` env var in Vercel before the custom domain goes live.
