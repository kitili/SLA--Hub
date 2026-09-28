# Validation at every boundary

Silverleaf uses **Zod v4** schemas to validate all data that crosses a trust
boundary: form submissions, route handler bodies, server action arguments, and
environment variables.

The golden rule: **never trust input; parse it at the boundary, fail fast.**

---

## Core utilities

| Import path | What it provides |
|---|---|
| `@/lib/validation` | Schemas, inferred types, `parseOrError` helper |
| `@/lib/contracts` | Hand-written DTO interfaces (the public API contract) |
| `@/lib/env` | Typed, validated `process.env` values |

---

## The `parseOrError` helper

```ts
import { parseOrError } from "@/lib/validation";
```

```ts
function parseOrError<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; error: ApiError }
```

- On success: `{ ok: true, data }` — fully typed.
- On failure: `{ ok: false, error: ApiError }` — an `ApiError` envelope with
  `code: "VALIDATION_ERROR"` and per-field messages in `fieldErrors`.

---

## Worked example — server action

```ts
// src/app/onboarding/actions.ts
"use server";

import { parseOrError, registerStaffSchema } from "@/lib/validation";
import type { ApiError } from "@/lib/contracts";

export async function registerStaffAction(
  rawInput: unknown,
): Promise<{ staffId: string } | ApiError> {
  // 1. Parse at the boundary — fail fast with a structured error
  const parsed = parseOrError(registerStaffSchema, rawInput);
  if (!parsed.ok) {
    return parsed.error; // ApiError: { error: { code, message, fieldErrors } }
  }

  // 2. `parsed.data` is fully typed: RegisterStaffInput
  const { email, fullName, campus, jobTitle } = parsed.data;

  // 3. Hand off to the data layer (db module lives in src/lib/db/)
  const staff = await db.createStaff({ email, fullName, campus, jobTitle });

  return { staffId: staff.id };
}
```

The caller checks `isApiError(result)` before accessing `.staffId`:

```ts
import { isApiError } from "@/lib/contracts";

const result = await registerStaffAction(formData);
if (isApiError(result)) {
  // result.error.fieldErrors?.email?.[0] → "A valid email address is required."
  showFormErrors(result.error.fieldErrors);
  return;
}
// result.staffId is now safe to use
redirect(`/onboarding/${result.staffId}`);
```

---

## Worked example — route handler

```ts
// src/app/api/progress/mark-read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parseOrError, markReadSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();

  const parsed = parseOrError(markReadSchema, body);
  if (!parsed.ok) {
    return NextResponse.json(parsed.error, { status: 422 });
  }

  const { staffId, itemId } = parsed.data;
  // … persist to DB …
  return NextResponse.json({ ok: true });
}
```

---

## Environment variables

`src/lib/env.ts` parses `process.env` once at module load using a Zod schema.
Import `env` instead of `process.env` everywhere server-side:

```ts
import { env } from "@/lib/env";

const dbUrl = env.DATABASE_URL; // string | undefined — typed, never surprises
```

If a variable is present but malformed (e.g. `DATABASE_URL` is not a valid
URL), the schema throws at startup so the error surfaces immediately rather than
as a cryptic runtime failure.

---

## Where to add new schemas

Add schemas to `src/lib/validation/schemas.ts` and barrel-export them from
`src/lib/validation/index.ts`.  Follow the pattern:

1. Define a `z.object(…)` schema.
2. Export `export type MyInput = z.infer<typeof mySchema>` directly below it.
3. Use `parseOrError(mySchema, rawInput)` at the boundary — never call
   `.parse()` directly in route handlers or actions.
