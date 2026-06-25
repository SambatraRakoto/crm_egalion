import { defineConfig } from 'vitest/config';

// Backend is CommonJS, so expose the test API as globals (describe/it/expect/vi)
// instead of importing it — `require('vitest')` is not supported.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
