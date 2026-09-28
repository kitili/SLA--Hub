# Server-action result contract

Every server action in `src/lib/actions/` returns the shared `ActionResult`
shape from `src/lib/contracts/action.ts` (import from `@/lib/contracts`):

```typescript
interface ActionResult<TCode extends string = ActionErrorCode> {
  ok: boolean;
  error?: TCode;     // machine-readable failure code — map to i18n in the UI
  message?: string;  // optional AUTHORED safe detail (never raw exceptions)
}
```

Actions extend it with their own optional data fields, e.g.

```typescript
export async function getScheme(schemeId: string): Promise<
  ActionResult & {
    scheme?: typeof schemesOfWork.$inferSelect;
    lessons?: Array<typeof sowLessons.$inferSelect>;
  }
> { ... }
```

## Rules

1. **`error` is a code, never prose.** The default union is
   `"invalid-input" | "not-found" | "conflict" | "failed"`
   (`ActionErrorCode`); an action may declare a narrower or richer union when
   the UI needs to distinguish cases (see `SignInResult` in
   `src/lib/actions/member.ts` and `SubmitFeedbackResult` in
   `src/lib/actions/feedback.ts`).
2. **Never return `err.message` to the client.** Wrap failures with
   `actionFailure(code, { cause: err })` — it `console.error`s the real error
   server-side and returns only the code. DB/driver/parser internals must not
   reach the browser.
3. **`message` is for authored detail only** — text the action deliberately
   composed for the user, e.g. joined validation issues in
   `savePlanStructured`. UIs show `message` when present, otherwise translate
   the code (most admin panels fall back to their `errorGeneric` key).
4. **UI mapping.** Client components switch on `ok` and map codes to i18n
   keys; they never render `error` directly. Example: `PlansTable` maps
   `"conflict"` from `deletePlan` to `lpAdmin.plans.table.deleteConflict`.

## Worked example

```typescript
export async function deleteScheme(schemeId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!schemeId) return actionFailure("invalid-input");
  try {
    await db.delete(schemesOfWork).where(eq(schemesOfWork.id, schemeId));
    // Route PATTERN, not a literal: every page lives under the `[locale]`
    // segment, so a locale-less literal like "/admin/ai-studio/schemes"
    // never matches the filesystem route ("/en/…", "/sw/…") and revalidates
    // nothing — see the explanation in src/lib/actions/feedback.ts.
    revalidatePath("/[locale]/admin/ai-studio/schemes", "page");
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err }); // logged, not leaked
  }
}
```
