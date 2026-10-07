import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**", "**/playwright-report/**"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
