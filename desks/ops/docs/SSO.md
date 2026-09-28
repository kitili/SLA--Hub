# Google SSO (Supabase Auth)

Part of production handover — see [`docs/DEPLOY.md`](./DEPLOY.md) §3.

Staff can sign in with Google on `/login`. Email/password remains available.

Domain restriction: only `@silverleaf.co.tz` accounts are accepted. Others are signed out on the auth callback.

No extra app env vars are required beyond the usual Supabase URL + anon key, once the Google provider is enabled in the dashboard.

## Supabase dashboard steps

1. Open your project → **Authentication** → **Providers** → **Google**.
2. Enable Google.
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Application type: **Web application**
   - Authorized redirect URI:  
     `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Paste **Client ID** and **Client secret** into the Supabase Google provider form → Save.
5. **Authentication → URL configuration**:
   - **Site URL**: production app origin (e.g. `https://ops.example.com`) or `http://localhost:3000` for local.
   - **Redirect URLs** (add all you use):
     - `http://localhost:3000/auth/callback`
     - `https://<your-production-host>/auth/callback`
6. Optional but recommended (Google Workspace): restrict the OAuth client to your Workspace domain, or set an authorized domain list so only `@silverleaf.co.tz` can complete Google consent. The app also rejects other domains after callback.

## App flow

1. User clicks **Continue with Google** on `/login`.
2. Supabase OAuth redirects to Google, then back to `/auth/callback?code=…`.
3. Callback exchanges the code for a session (`@supabase/ssr`).
4. If `user.email` is not `@silverleaf.co.tz` → `signOut` → `/login?error=domain`.
5. Otherwise redirect to the role home (`profiles.role` / metadata) or `?next=` when allowed.

## Roles after first Google login

`handle_new_user` creates a `profiles` row (default `matron` unless `user_metadata.role` is set).  
Promote admins/finance with [`docs/STAFF_USERS.md`](./STAFF_USERS.md) or by editing `profiles.role` in the Table Editor.

## Local smoke test

1. Complete dashboard steps with localhost redirect URLs.
2. `npm run dev` → `/login` → **Continue with Google**.
3. Sign in with a `@silverleaf.co.tz` account; confirm redirect to `/admin/dashboard` or `/matron`.
4. Try a non-domain Google account → should land on `/login?error=domain`.
