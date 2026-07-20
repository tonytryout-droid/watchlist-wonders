import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "WatchMarks - Your Streaming Companion",
        short_name: "WatchMarks",
        description:
          "Save links from any streaming platform, organize your watchlist, and never forget what to watch next.",
        theme_color: "#dc2626",
        background_color: "#0a0a0a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        share_target: {
          action: "/share-target",
          method: "GET",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Firestore REST API: network-first, 3s timeout
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "firestore-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Firebase Storage: cache-first, 7 days
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "firebase-storage",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // TMDB images: cache-first, 30 days
            urlPattern: /^https:\/\/image\.tmdb\.org\//,
            handler: "CacheFirst",
            options: {
              cacheName: "tmdb-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Poster/backdrop CDNs used by enriched metadata
            urlPattern: ({ request, url }) =>
              request.destination === "image" &&
              ["m.media-amazon.com", "i.ytimg.com"].includes(url.hostname),
            handler: "CacheFirst",
            options: {
              cacheName: "external-media-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 950,
    // Generate source maps but exclude the comment that would expose them in
    // production browsers. They're still available in the build output for
    // upload to a monitoring service (Sentry, etc.).
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase")) return "firebase";
          if (id.includes("node_modules/@tanstack")) return "query";
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/date-fns")) return "date-fns";
          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/embla-carousel-react")
          ) {
            return "ui";
          }
          return undefined;
        },
      },
    },
  },
}));
