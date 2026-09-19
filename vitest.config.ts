import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` is a Next.js build-time guard with no runtime export map
      // that Vitest can resolve. Stub it so server modules can be unit-tested
      // directly; the guard still applies in the real Next build.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
