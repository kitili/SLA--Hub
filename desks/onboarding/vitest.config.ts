import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    /**
     * Map `server-only` to its empty shim so `import "server-only"` does not
     * throw in the test process. The package's `react-server` export condition
     * points at `empty.js`, but Vite/Vitest doesn't auto-activate that
     * condition; using an alias is simpler and more reliable.
     */
    alias: {
      /**
       * Redirect `server-only` to a local empty shim instead of the package's
       * `empty.js` (which is not exported under the test conditions in Vite 8).
       * This prevents the "cannot be imported from a Client Component" throw.
       */
      "server-only": new URL("./test/server-only-mock.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "test/**/*.test.ts",
    ],
    // Each worker runs setup.ts (which migrates its own in-memory PGlite), so
    // the DB-backed tests are self-contained per worker.
  },
});
