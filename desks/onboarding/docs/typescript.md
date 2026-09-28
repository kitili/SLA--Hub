# TypeScript configuration

This project uses a **strict** TypeScript setup. The source of truth is
[`tsconfig.json`](../tsconfig.json) at the repo root; this document explains the
non-default choices and how to run the type checker.

## Type checking

```bash
npm run typecheck
```

This runs `tsc --noEmit` — it type-checks the whole project without emitting
JavaScript (Next.js / the bundler handles transpilation). It must pass cleanly
before code is merged.

## Strict settings

| Option                     | Value  | Why |
| -------------------------- | ------ | --- |
| `strict`                   | `true` | Enables the full strict family (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict`). |
| `noUncheckedIndexedAccess` | `true` | Indexed access (`arr[i]`, `obj[key]`) yields `T \| undefined`, forcing callers to handle the missing case. Prevents a common class of runtime `undefined` bugs. |
| `noImplicitOverride`       | `true` | Methods that override a base-class member must use the `override` keyword, so renames in a base class surface as errors instead of silently diverging. |

These are in addition to the Next.js defaults carried over from
`create-next-app` (`moduleResolution: "bundler"`, `isolatedModules`,
`esModuleInterop`, `skipLibCheck`, `jsx: "preserve"`, the `next` TS plugin, etc.).

## Path alias

A single path alias is configured:

| Alias  | Resolves to | Example |
| ------ | ----------- | ------- |
| `@/*`  | `./src/*`   | `import { Foo } from "@/components/Foo";` |

Application code lives under [`src/`](../src), so `@/app/...`,
`@/components/...`, `@/lib/...` etc. all resolve from there. Prefer the alias
over deep relative paths (`../../../`).

## Scope / excludes

`legacy/` (the pre-migration Vite + Express monorepo, kept for reference while
routes are ported) is **excluded** from `tsconfig.json` and is not part of the
Next.js build. Only files under the repo root that match
`**/*.ts` / `**/*.tsx` (primarily `src/`) are type-checked.
