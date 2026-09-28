import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "legacy/**",
      "client/**",
      ".claude/**",
      "silverleaf-lesson-plans-antoine/**",
      "docs/superpowers/**",
      "test-results/**",
      "playwright-report/**",
      "src/app/.well-known/**",
    ],
  },
  {
    // Everything rendered inside the `[locale]` tree must link via the
    // locale-aware helpers in src/i18n/navigation.ts — a raw next/link href
    // has no locale prefix and only "works" through a middleware redirect
    // that can land on the wrong locale. (src/app/error.tsx and not-found.tsx
    // sit outside the locale segment and may keep next/link.)
    files: ["src/app/\\[locale\\]/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Use Link from @/i18n/navigation (locale-aware) instead of next/link.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
