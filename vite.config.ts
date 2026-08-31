import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the built app works from any static host or subpath
  // (GitHub Pages project sites, Netlify, a phone opening dist/ directly, etc.)
  base: "./",
  server: {
    host: true, // expose on the LAN so you can open it on your phone during dev
  },
});
