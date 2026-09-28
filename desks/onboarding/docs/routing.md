# Route Map

Route topology ported from the legacy Vite/React Router 7 SPA (`legacy/client/src/App.jsx`) to the Next.js 15 App Router.

## Legacy → App Router mapping

| Legacy route (React Router 7) | Legacy component    | App Router segment file                          | Status      |
|-------------------------------|---------------------|--------------------------------------------------|-------------|
| `/`                           | `Dashboard`         | `src/app/page.tsx`                               | Placeholder |
| `/section/:sectionId`         | `SectionPage`       | `src/app/section/[sectionId]/page.tsx`           | Placeholder |
| `/view?path=…`                | `DocumentViewer`    | `src/app/view/page.tsx`                          | Placeholder |
| `/admin`                      | `AdminDashboard`    | `src/app/admin/page.tsx`                         | Placeholder |

> The legacy app also had a `/kanban` route (`Kanban` component). It has been omitted from this port as it is not part of the core SPA (it was added as a standalone hackathon feature and has no corresponding F-series task at this stage).

## Deferred concerns

- **Auth gating (F3):** The legacy `AppGate` component blocked rendering until a staff member was signed in and redirected to `StaffRegistration` when unauthenticated. The `AdminPinModal` gated the admin route additionally. This logic is deferred to epic F3 (identity). Each placeholder page carries a `// TODO(F3): auth gating` comment marking where it attaches.

- **Locale prefix routing (F4):** The legacy SPA had no i18n. The Next.js migration plan adds next-intl locale prefixes (e.g. `/en/`, `/de/`) as a separate concern in epic F4. Each placeholder page and the root layout carry a `// TODO(F4): locale routing` comment marking where next-intl wraps the segment tree.

- **Branded Layout (F1.3):** The legacy `Layout` component (shell, sidebar, header) is ported in task F1.3. The root `layout.tsx` currently contains only a bare navigation for manual verification.
