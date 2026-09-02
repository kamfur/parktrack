import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    envDir: ".",
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
