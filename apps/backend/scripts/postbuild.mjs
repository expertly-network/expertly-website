import { cpSync, existsSync, rmSync } from 'node:fs';

// nest build's tsc invocation infers rootDir from every file in the type-checking
// program, including packages/shared-types/*.ts (reached only via the @shared/*
// path alias as `import type`). That pushes the inferred root up to the repo root,
// so a clean build emits to dist/apps/backend/src/* and dist/packages/shared-types/*
// instead of dist/*. Flatten that back to the plain dist/main.js shape the rest of
// the app/Docker image expects.
const nested = 'dist/apps/backend/src';
if (existsSync(nested)) {
  cpSync(nested, 'dist', { recursive: true });
  rmSync('dist/apps', { recursive: true, force: true });
}
rmSync('dist/packages', { recursive: true, force: true });
