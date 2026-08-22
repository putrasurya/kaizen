import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Node's own experimental native Web Storage API (on by default in recent Node
// versions) collides with jsdom's localStorage implementation inside the test
// workers, leaving window.localStorage undefined. Set before defineConfig so it's
// inherited by every worker vitest spawns, regardless of how `npm test` itself is
// invoked (avoids relying on shell-specific env-var-prefix syntax in scripts).
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-experimental-webstorage`;

export default defineConfig({
  plugins: [react()],
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
