import { spawn } from 'node:child_process';

// `nest start --watch` assumes a flat dist/main.js entry, but this project's tsconfig
// deliberately has no explicit rootDir (see tsconfig.json's comment-free but load-bearing
// absence of one, and scripts/postbuild.mjs's own comment) — cross-package `import type`
// from packages/shared-types pulls files outside apps/backend into the compile program,
// and setting rootDir explicitly to fix the flat-output path breaks that (TS6059: file
// not under rootDir). `npm run build` works around this with postbuild.mjs's flatten
// step; that step doesn't need to run for dev, so this just points Node's own --watch
// restart behavior at the real (nested) compiled entry nest build actually produces.
const ENTRY = 'dist/apps/backend/src/main.js';
const NEST = 'node_modules/.bin/nest';

function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exit(code);
  });
  return child;
}

// One-off build first so ENTRY exists before `node --watch` starts — it can't watch a
// file that doesn't exist yet.
await new Promise((resolve, reject) => {
  const build = run(NEST, ['build']);
  build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`nest build exited ${code}`))));
});

run(NEST, ['build', '--watch']);
run('node', ['--watch', ENTRY]);
