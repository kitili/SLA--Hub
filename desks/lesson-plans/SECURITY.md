# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a vulnerability

This is an internal Silverleaf Academy application. Do **not** open public GitHub issues for security concerns.

Report issues privately to:

- **HR / IT:** hr@silverleaf.co.tz

Include steps to reproduce, affected URLs, and any relevant logs.

## Security practices

- Never commit `.env` or production credentials
- Set a strong random `SESSION_SECRET` in production (required — signs the auth cookie)
- `ADMIN_PIN` is optional — its self-elevation backend (`verifyAdminPin`) is currently unreachable (no UI collects a PIN; `HR_ADMIN_EMAILS` alone grants `/admin`). If you set it anyway, choose a fresh strong value
- Restrict `HR_ADMIN_EMAILS` to authorised staff
- Set `ED_ADMIN_API_TOKEN` in production (without it sign-in fails closed; never set `ALLOW_DEMO_AUTH` outside demo deploys)
- Use HTTPS in production
