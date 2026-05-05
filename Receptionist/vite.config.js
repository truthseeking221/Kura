import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(() => {
  const target = process.env.KURA_TARGET;

  return {
    plugins: [react()],
    build: target === "pwa"
      ? {
          outDir: "dist-pwa",
          rollupOptions: {
            input: resolve(__dirname, "pwa.html"),
          },
        }
      : undefined,
  };
});
