// Отдельная сборка для Capacitor APK: чистый React SPA, никакого SSR/TanStack Start.
// Все server-функции подменяются client-шимами через resolve.alias.
// Собирается командой: bunx vite build --config vite.capacitor.config.ts
// Результат кладётся в www/, оттуда copy в android/app/src/main/assets/public/.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  base: "./",
  plugins: [tsconfigPaths(), react(), tailwindcss()],
  resolve: {
    alias: [
      // Подменяем каждый .functions модуль на клиентский эквивалент
      { find: /^@\/lib\/sales\.functions$/, replacement: r("src/lib/sales.functions.client.ts") },
      { find: /^@\/lib\/shifts\.functions$/, replacement: r("src/lib/shifts.functions.client.ts") },
      { find: /^@\/lib\/cashiers\.functions$/, replacement: r("src/lib/cashiers.functions.client.ts") },
      { find: /^@\/lib\/schedules\.functions$/, replacement: r("src/lib/schedules.functions.client.ts") },
      { find: "@", replacement: r("src") },
    ],
  },
  build: {
    outDir: "www",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      input: r("capacitor.html"),
    },
  },
  define: {
    // Отключаем PWA/SW внутри APK — Capacitor уже даёт нативный контейнер
    "import.meta.env.SSR": "false",
  },
});
