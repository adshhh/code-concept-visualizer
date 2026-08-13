import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Pyodide's runtime (wasm + the stdlib zip) is fetched by URL at runtime, not bundled
    // into JS — self-hosted rather than CDN-loaded, per §2 ("no backend, no sandbox
    // service, static deploy") and so AC-2.5's bundle report can inspect what's actually
    // shipped instead of trusting a third-party CDN at runtime.
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/pyodide/{pyodide.asm.mjs,pyodide.asm.wasm,python_stdlib.zip,pyodide-lock.json,pyodide.mjs}",
          dest: "pyodide",
          // Without this, the plugin preserves "node_modules/pyodide/..." under dest,
          // landing files at dist/pyodide/node_modules/pyodide/* instead of dist/pyodide/*
          // — silently breaking every fetch indexURL: "/pyodide/" makes in worker.ts.
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  // Pyodide manages its own dynamic imports/wasm loading; letting esbuild pre-bundle it in
  // dev breaks that. Documented Vite+Pyodide integration requirement, not a workaround.
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
