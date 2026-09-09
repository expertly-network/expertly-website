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

const children = new Set();

function run(cmd, args) {
  // detached so each child is its own process-group leader — on shutdown we kill the
  // whole group (see killAll). A plain SIGTERM to just this pid leaves `node --watch`'s
  // internal worker process — the one that actually binds the port — orphaned and still
  // holding it for the next `pnpm dev`.
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true, detached: true });
  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    if (code && code !== 0) {
      killAll();
      process.exit(code);
    }
  });
  return child;
}

function killAll() {
  for (const child of children) {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already gone
      }
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    killAll();
    process.exit(0);
  });
}

// One-off build first so ENTRY exists before `node --watch` starts — it can't watch a
// file that doesn't exist yet.
await new Promise((resolve, reject) => {
  const build = run(NEST, ['build']);
  build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`nest build exited ${code}`))));
});

run(NEST, ['build', '--watch']);
run('node', ['--watch', ENTRY]);
