# Contributing

Internal project for Silverleaf Academy. Thank you for helping improve the
lesson-plans app.

## Getting started

1. Clone the repository and follow [README.md](./README.md) (Node ≥ 22.6).
2. Create a branch from `main`.
3. Make focused changes with clear, conventional commit messages.
4. Before opening a pull request, run:

   ```bash
   npm run typecheck && npm run lint && npm run test
   ```

   Playwright e2e (`npm run e2e`) is optional locally; CI runs it too.

## Guidelines

- Match existing code style and naming conventions (see `docs/` and
  [CLAUDE.md](./CLAUDE.md) for the load-bearing ones).
- Keep changes scoped — one feature or fix per PR.
- Never commit `.env`/`.env.local` (the tracked `.env.example` files hold
  placeholders only), `.pglite/`, `.storage/`, or `node_modules/`.
- UI strings live in `messages/en/*.json` **and** `messages/sw/*.json` — keep
  both catalogs in exact key parity (a unit test enforces this).

## Pull requests

Include in the description:

- What changed and why
- How you tested it
- Screenshots for UI changes

## Questions

Contact the project maintainer.
