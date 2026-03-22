import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  server: { host: "::", port: 5173, proxy: { "/api": "http://localhost:3000" } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Espaço Terapêutico",
        short_name: "EspTerapêutico",
        description: "Sistema de gestão para profissionais de saúde mental",
        theme_color: "#2a2523",
        background_color: "#f5f2ee",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
        categories: ["health", "medical", "productivity"],
        shortcuts: [
          { name: "Agenda", url: "/agenda", icons: [{ src: "/favicon.svg", sizes: "any" }] },
          { name: "Pacientes", url: "/pacientes", icons: [{ src: "/favicon.svg", sizes: "any" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com/, handler: "CacheFirst", options: { cacheName: "google-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com/, handler: "CacheFirst", options: { cacheName: "gstatic-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } } },
          { urlPattern: /\/api\//, handler: "NetworkFirst", options: { cacheName: "api-cache", expiration: { maxEntries: 50, maxAgeSeconds: 300 } } },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
