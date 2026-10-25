import { defineConfig } from 'vitest/config'

// Pure-logic tests (normalisation, telemetry); they run in Node, no Workers runtime needed.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
})
