# Silverleaf Visitor Log — MVP

A single-page visitor sign-in system for Silverleaf Academy's five campuses
(Usa River, Arusha Town, Kijenge, Ilboru, Boma), backed by Firebase Firestore.

It has two views:
- **Front desk** — sign a visitor in (name, phone, purpose, host, optional
  photo), see who's currently on site per campus, sign them out.
- **Dashboard** — stats and a full table across all campuses/dates, with
  CSV export.

## 1. Set up Firebase (free tier is enough)

1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   sign in, click **Add project**. Skip Google Analytics.
2. In the sidebar: **Build → Firestore Database → Create database**. Pick a
   region close to Tanzania. Start in **test mode** for now.
3. On the project overview page, click the web icon (`</>`) to register a
   web app. You don't need Firebase Hosting — this repo deploys to Vercel.
4. Copy the `firebaseConfig` object shown after registering.
5. In Firestore → **Rules**, for prototype/internal testing:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Tighten this (add auth) before real visitor data goes through it.

## 2. Add your config

Open `index.html`, find this near the top of the `<script>` tag:

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Replace the placeholder values with what you copied in step 1.4.

## 3. Deploy to Vercel

No build step — it's a single static HTML file.

**Option A — GitHub:**
1. Push this folder to a new GitHub repo.
2. At [vercel.com](https://vercel.com) → **Add New Project** → import the repo → Deploy.

**Option B — CLI:**
```bash
npm i -g vercel
cd silverleaf-visitor-log
vercel
```

## Data model

Each visit is a document in the `visits` collection:

| Field         | Type    | Notes                              |
|---------------|---------|-------------------------------------|
| name          | string  | required                            |
| phone         | string  |                                      |
| purpose       | string  |                                      |
| host          | string  | required — person/office visited    |
| campus        | string  | one of the 5 campus names           |
| date          | string  | `YYYY-MM-DD`, used for daily filters|
| photo         | string  | base64 JPEG data URL, optional      |
| signedInAt    | string  | ISO timestamp                       |
| signedOutAt   | string  | ISO timestamp, null while on site   |

## Known limitations (by design, for an MVP)

- No login/auth — anyone with the link can sign visitors in and view the
  dashboard. Fine for internal testing, not for production.
- Photos are stored as base64 text in Firestore, not Cloud Storage — fine
  at prototype volume, but should move to Firebase Storage before scale.
- Not yet integrated with Silverleaf's SIS.
- Brand colors are currently a placeholder palette (pine green / ochre) —
  swap the CSS variables at the top of `index.html` once Silverleaf's
  official hex codes are available.
