#!/usr/bin/env bash
# Kill every process belonging to this repo's dev stack — including orphaned
# watchers left running from a terminal tab that was closed instead of Ctrl+C'd.
#
# Killing only whatever currently holds ports 4000/4001 isn't enough: the
# backend's `nest build --watch` + `node --watch dist/.../main.js` pair can
# survive as an orphan (no controlling terminal) and respawn a fresh child —
# which rebinds the port — on the next rebuild. This kills the whole tree
# (turbo -> pnpm -> nest build --watch / node --watch / next dev), current
# and orphaned copies alike.
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTS="4000,4001"

echo "== Currently listening on ${PORTS} =="
lsof -nP -iTCP:"${PORTS}" -sTCP:LISTEN || echo "  none"

# Repo-specific command patterns — distinctive enough to match by string
# alone without risking another project's process on this machine.
SPECIFIC_PATTERN='nest\.js build --watch|node --watch dist/apps/backend/src/main\.js|apps/backend/scripts/dev\.mjs|turbo run dev|next/dist/bin/next dev'

matches="$(pgrep -f "${SPECIFIC_PATTERN}" || true)"

# Generic "pnpm dev" / "pnpm run dev" / "pnpm --filter ... dev" could belong
# to a different project on this machine, so only include them if their cwd
# is actually inside this repo.
for pid in $(pgrep -f 'pnpm( run)? dev|pnpm --filter \./apps/(backend|frontend) dev' || true); do
  cwd="$(lsof -a -p "${pid}" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  if [[ "${cwd}" == "${PROJECT_DIR}"* ]]; then
    matches="${matches}
${pid}"
  fi
done

matches="$(echo "${matches}" | grep -v '^$' | sort -un || true)"

if [[ -z "${matches}" ]]; then
  echo "== No matching dev processes found =="
else
  echo "== Killing these processes =="
  echo "${matches}" | xargs ps -o pid=,lstart=,command= -p 2>/dev/null || true

  echo "${matches}" | xargs kill 2>/dev/null || true
  sleep 2

  survivors="$(echo "${matches}" | xargs ps -p 2>/dev/null | awk 'NR>1{print $1}')"
  if [[ -n "${survivors}" ]]; then
    echo "== Force-killing survivors: ${survivors} =="
    echo "${survivors}" | xargs kill -9 2>/dev/null || true
  fi
fi

echo "== Ports ${PORTS} after cleanup =="
lsof -nP -iTCP:"${PORTS}" -sTCP:LISTEN || echo "  clear"
