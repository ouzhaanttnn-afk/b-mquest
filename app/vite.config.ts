import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    // Playwright specs are run with `npx playwright test`, not Vitest.
    exclude: ['**/node_modules/**', 'tests/**/*.spec.ts'],
  },
});
