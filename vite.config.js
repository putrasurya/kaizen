import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Node's own experimental native Web Storage API (on by default in recent Node
// versions) collides with jsdom's localStorage implementation inside the test
// workers, leaving window.localStorage undefined. Set before defineConfig so it's
// inherited by every worker vitest spawns, regardless of how `npm test` itself is
// invoked (avoids relying on shell-specific env-var-prefix syntax in scripts).
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-experimental-webstorage`;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A reload mid-countdown would interrupt running timers, so never reload on
      // our own — AppUpdatePrompt asks the user first (see src/components).
      registerType: 'prompt',
      // Registration is done explicitly via virtual:pwa-register/react.
      injectRegister: false,
      // Precached alongside the manifest icons, which the plugin adds on its own.
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Kaizen: Your companion for continuous productivity',
        short_name: 'Kaizen',
        description:
          'MultiTimer is a Multiple Timer App, it is straightforward to use and may help boost your productivity. Use this as your Pomodoro timer, daily routine timer, etc',
        // Matches index.css's body background and antd's dark algorithm.
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell only. There's no backend (state lives in
        // localStorage); YouTube embeds and Google Analytics are cross-origin and
        // deliberately left to the network. The ~2.6MB alarm .wav is also left
        // out: <audio> fetches it with Range requests, which a precached 200
        // response doesn't serve reliably on every browser.
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // Keep the output directory CRA used to produce, so the Dockerfile
    // ("serve -s build") and CI's SOURCE_DIR keep working unchanged.
    outDir: 'build',
  },
  test: {
    environment: 'jsdom',
    // jsdom only exposes window.localStorage for a real http(s) origin — without
    // this it's left undefined, which breaks redux/store.js's module-load-time read.
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  },
});
