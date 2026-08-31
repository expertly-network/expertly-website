import { execSync } from 'node:child_process';

// nest build's tsc invocation infers rootDir from every file in the type-checking program,
// including packages/shared-types/*.ts (reached via the @shared/* path alias — a real runtime
// import now, for the response DTOs Swagger documents, not just `import type`). That pushes the
// inferred root up to the repo root, so a clean build emits to dist/apps/backend/src/* and
// dist/packages/shared-types/* instead of a flat dist/*.
//
// This used to get flattened back to a plain dist/main.js shape here, but tsc-alias (next line)
// computes each rewritten require() path from tsc's own rootDir/outDir mapping, not from wherever
// a file has since been manually moved to — flattening only the backend's own files (and not
// packages/shared-types alongside them, which can't be flattened the same way, it was never
// nested under apps/backend/src to begin with) breaks that mapping's relative depth. Simplest
// correct fix: don't fight the nested structure tsc actually produces — keep it, and point every
// consumer (package.json's start script, the Dockerfile's CMD, scripts/dev.mjs's ENTRY) at
// dist/apps/backend/src/main.js instead of a flattened dist/main.js.
execSync('tsc-alias', { stdio: 'inherit' });
