import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  define: {
    // Expose a small mapping so code can reference `import.meta.env` in older tooling.
    // Vite already exposes `import.meta.env` — this is just a noop placeholder.
  }
});
