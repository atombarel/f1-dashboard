import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pure-logic tests (normalisation, telemetry, client-side maths); they run in Node, no Workers runtime needed.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: { include: ['test/**/*.test.ts'] },
})
