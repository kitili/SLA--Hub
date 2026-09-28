# Driver documents & renewal alerts

**SQL (required):** run [`supabase/migrate_driver_docs_self_service.sql`](../supabase/migrate_driver_docs_self_service.sql) in the Supabase SQL Editor.

## What drivers get (Account)

- Upload / replace / delete: portrait, CV, driving licence, PSV badge, medical cert, national ID, passport  
- Set renewal + vehicle service dates  
- Compliance chips when something expires within ~7 days  

## What admin gets (Transport → Drivers)

- Same document slots and dates on each driver  
- Compliance banner on dashboard / alerts (~7-day window)  
- Bus insurance expiry still checked with the assigned driver  

## Alerts

Daily cron: `GET /api/cron/driver-compliance` at 06:00 UTC (see `vercel.json`).

SMS to:

- Admin (`ADMIN_ALERT_PHONE`)  
- Driver (`drivers.phone`)  

Needs `CRON_SECRET` + Africa’s Talking keys (otherwise stub-logged). Deduped weekly per alert key in `driver_compliance_alerts`.
