import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next preserves JSX for its own compiler; component tests need it transformed.
  oxc: { jsx: { runtime: 'automatic' } },
  // `@/*` and `@shared/*` come from tsconfig.json's paths, same as Next.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
    // Node by default; specs that need a DOM opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    // Every spec runs offline against placeholder config — no real Supabase project or API.
    env: {
      SUPABASE_URL: 'https://project.supabase.test',
      SUPABASE_ANON_KEY: 'test-anon-key',
      API_URL: 'https://api.growxq.test',
    },
    restoreMocks: true,
  },
});
