import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (not esbuild) compiles the specs so Nest's decorators get emitDecoratorMetadata, which the
// DI container and the route-metadata reflection in the specs rely on.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  // `@shared/*` comes from tsconfig.json's paths, same as the build.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    // Every spec runs offline: no Supabase, OpenAI or other network calls.
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://project.supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
    restoreMocks: true,
  },
});
