import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona igual servida en la raiz de un dominio o
  // en un subdirectorio (por ejemplo https://usuario.github.io/Excel/).
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Separar las librerias grandes de la app: el navegador las cachea una vez
    // y los despliegues siguientes solo invalidan el chunk de la aplicacion.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          query: [
            '@tanstack/react-query',
            '@tanstack/react-query-persist-client',
            '@tanstack/query-sync-storage-persister',
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // El service worker se regenera en cada build y toma el control solo,
      // igual que hacia el sw.js manual (skipWaiting + clientsClaim).
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Seguimiento de Pagos',
        short_name: 'Pagos',
        description: 'Control de pagos por persona y periodo: abonos, atrasos y comprobantes de pago',
        lang: 'es-CO',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f4f7',
        theme_color: '#1a73e8',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        // Las peticiones a Supabase NO se cachean: los datos frescos llegan por
        // red y el modo offline lo cubre la cache persistida de TanStack Query.
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
