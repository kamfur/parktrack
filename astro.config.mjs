// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3000, host: "0.0.0.0" },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        "@radix-ui/react-collapsible",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-dialog",
        "@radix-ui/react-select",
        "@radix-ui/react-popover",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-label",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-slot",
      ],
    },
  },
  adapter: node({
    mode: "standalone",
  }),
});
