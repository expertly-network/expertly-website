import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (not esbuild) so Nest's constructor-parameter decorator metadata exists in e2e tests.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['src/**/*.test.ts'], exclude: ['dist/**', 'node_modules/**'] },
});
