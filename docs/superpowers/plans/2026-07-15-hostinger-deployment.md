# Hostinger Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the existing frontend+backend scaffold live on Hostinger, reachable at `https://expertly.network` (frontend) and `https://api.expertly.network` (backend), matching `docs/deployment-guide-hostinger.md`.

**Architecture:** Build Docker images locally, push to GitHub Container Registry (GHCR), point new/updated Hostinger DNS records at the existing VPS (`91.108.104.17`), and deploy a `docker-compose.prod.yml` (backend + frontend + a Caddy reverse proxy that auto-handles HTTPS) to that VPS via the `hostinger-vps` MCP tool. No CI — every step here is triggered manually, per the approved design.

**Tech Stack:** Docker, Docker Compose, Caddy 2 (reverse proxy + automatic TLS), GHCR, Hostinger VPS/DNS MCP tools, git/GitHub.

---

## Important context before starting

- **The GitHub repo is currently completely empty** (`git ls-remote` returns nothing; confirmed via GitHub API). All existing scaffold code (`backend/`, `frontend/`, `docker-compose.yml`, `README.md`, `docs/`) is untracked locally and has never been pushed.
- **Credential mismatch:** the `gh` CLI / git's cached credential (osxkeychain) is logged in as GitHub user `unetra-global`, which only has **read** access to `expertly-network/expertly-website` (`push: false`, confirmed via `gh api repos/expertly-network/expertly-website --jq .permissions`). The GitHub MCP server's token (user `Cibi-M`) has `push: true` on this repo. **Every git push in this plan must authenticate as `Cibi-M`, not rely on the default cached credential.**
- The Cibi-M token is stored in `~/.gemini/config/mcp_config.json` at `mcpServers.github-mcp-server.env.GITHUB_PERSONAL_ACCESS_TOKEN`. Read it fresh from that file each time it's needed — never hardcode it in a command that gets logged verbatim or committed.
- The VPS (`srv1103127.hstgr.cloud`, ID `1103127`, IP `91.108.104.17`) has **no Hostinger-level firewall attached** (`VPS_getFirewallListV1` returned an empty list) — so ports 80/443 aren't blocked at that layer. If they turn out to be blocked at the OS level (ufw) once deployed, that's a VPS-console/SSH fix outside this plan's MCP-only scope — flag it if Task 8's verification fails with a connection timeout (not a TLS/cert error).
- `expertly.network`'s DNS **A record currently exists** and points at Hostinger shared hosting — Task 5 overwrites it. `api.expertly.network` is a **new** record.

---

### Task 1: Write `docker-compose.prod.yml`

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Write the file**

```yaml
services:
  backend:
    image: ghcr.io/expertly-network/expertly-backend:latest
    container_name: expertly-backend
    restart: unless-stopped
    environment:
      - PORT=${BACKEND_PORT:-4000}
    expose:
      - "4000"

  frontend:
    image: ghcr.io/expertly-network/expertly-frontend:latest
    container_name: expertly-frontend
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      - PORT=${FRONTEND_PORT:-3000}
    expose:
      - "3000"

  caddy:
    image: caddy:2
    container_name: expertly-caddy
    restart: unless-stopped
    depends_on:
      - frontend
      - backend
    ports:
      - "80:80"
      - "443:443"
    entrypoint: ["sh", "-c"]
    command:
      - |
        cat <<'EOF' > /etc/caddy/Caddyfile
        expertly.network {
          reverse_proxy frontend:3000
        }
        api.expertly.network {
          reverse_proxy backend:4000
        }
        EOF
        exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
    volumes:
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

Notes for whoever implements this:
- `backend`/`frontend` use `expose` (internal-only), not `ports` — Caddy is the only public entry point, matching the approved design.
- The Caddy config is generated inline via the `command:` heredoc instead of a bind-mounted `Caddyfile`, because Hostinger's deploy tool (`VPS_createNewProjectV1`, used in Task 7) only ingests a single docker-compose YAML blob — it cannot also upload a companion file. Keeping the whole reverse-proxy config inside this one file avoids that limitation entirely.
- `caddy_data`/`caddy_config` are named volumes so issued TLS certificates persist across redeploys (as long as Hostinger's "replace existing project" behavior doesn't run `docker compose down -v` — unconfirmed either way; Task 8 verification will reveal if certs need re-issuing on every redeploy).
- `BACKEND_PORT`/`FRONTEND_PORT` env vars have defaults baked in (`4000`/`3000`) so this works even if Hostinger's `environment` field is left empty — but the mechanism is there for later real secrets (e.g. a database URL) without editing this file again.

- [ ] **Step 2: Validate the YAML parses and interpolates correctly**

Run: `docker compose -f docker-compose.prod.yml config`
Expected: prints the fully-resolved compose config (all three services, `PORT=4000`/`PORT=3000` resolved from defaults) with no errors. This only validates syntax/interpolation — it does not require the `ghcr.io/...` images to exist yet.

- [ ] **Step 3: Validate the embedded Caddy config is syntactically correct**

Run:
```bash
docker run --rm caddy:2 sh -c "cat <<'EOF' > /etc/caddy/Caddyfile
expertly.network {
  reverse_proxy frontend:3000
}
api.expertly.network {
  reverse_proxy backend:4000
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
```
Expected: `Valid configuration` (or similar success message), no parse errors.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "Add production docker-compose file for Hostinger deployment"
```

---

### Task 2: Update `README.md`'s deployment section

**Files:**
- Modify: `README.md` (the existing "## Deploying to Hostinger" section — replace it entirely)

- [ ] **Step 1: Replace the section**

Replace the existing `## Deploying to Hostinger` section (the 4-step placeholder one) with:

```markdown
## Deploying to Hostinger

Full step-by-step explanation (for newcomers to this flow): see
[docs/deployment-guide-hostinger.md](docs/deployment-guide-hostinger.md).

Quick reference for every release:

1. Push your commit to `main` on `expertly-network/expertly-website`.
2. Build both production images:
   ```bash
   docker build -t ghcr.io/expertly-network/expertly-backend:latest ./backend
   docker build -t ghcr.io/expertly-network/expertly-frontend:latest \
     --build-arg NEXT_PUBLIC_API_URL=https://api.expertly.network \
     ./frontend
   ```
3. Push both images to GHCR:
   ```bash
   docker push ghcr.io/expertly-network/expertly-backend:latest
   docker push ghcr.io/expertly-network/expertly-frontend:latest
   ```
4. Deploy/redeploy `docker-compose.prod.yml` to the VPS (via the
   `hostinger-vps` MCP tool's `VPS_createNewProjectV1`, or manually through
   hPanel) — this pulls the freshly-pushed images and restarts containers.
5. Verify `https://expertly.network` and `https://api.expertly.network/health`.

This is a fully manual flow by design — no CI/CD automation exists yet.
```

- [ ] **Step 2: Verify the file reads correctly**

Run: `cat README.md | grep -A 20 "## Deploying to Hostinger"`
Expected: shows the new section content, no leftover text from the old version below it.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Update README deployment section to match approved Hostinger flow"
```

---

### Task 3: First-ever push of the full scaffold to GitHub

**Files:** none created/modified — this pushes everything accumulated so far (the pre-existing untracked scaffold + Tasks 1-2's new commits).

- [ ] **Step 1: Confirm what's about to be pushed**

Run: `git status` and `git log --oneline`
Expected: `docker-compose.prod.yml` and `README.md` changes are committed (from Tasks 1-2); `.env.example`, `.gitignore`, `backend/`, `frontend/`, `docker-compose.yml`, `docs/` are still untracked (never committed).

- [ ] **Step 2: Stage and commit the remaining scaffold**

```bash
git add .env.example .gitignore backend frontend docker-compose.yml docs
git commit -m "Add full-stack scaffold: backend, frontend, docker-compose, docs"
```

- [ ] **Step 3: Push to GitHub authenticated as Cibi-M (not the default cached credential)**

The default cached credential (`unetra-global`) only has read access to this repo. Push using the Cibi-M token directly in the URL for this one command only — do not modify the stored remote URL or leave the token in any file:

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/Users/cchakr216@apac.comcast.com/.gemini/config/mcp_config.json'))['mcpServers']['github-mcp-server']['env']['GITHUB_PERSONAL_ACCESS_TOKEN'])")
git push "https://Cibi-M:${TOKEN}@github.com/expertly-network/expertly-website.git" main
unset TOKEN
```

Expected: push succeeds, prints something like `main -> main`. If it instead prompts for a username/password interactively or fails with `403`, the token lacks `contents: write` — stop and report back rather than trying alternate auth methods.

- [ ] **Step 4: Verify the push landed**

Run: `gh api repos/expertly-network/expertly-website/commits --jq '.[0].commit.message'`
Expected: prints the most recent commit message (the scaffold commit from Step 2), not the `409 Git Repository is empty` error seen before this task.

---

### Task 4: Confirm GHCR push access with the Cibi-M token

**Files:** none.

- [ ] **Step 1: Attempt Docker login to GHCR**

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/Users/cchakr216@apac.comcast.com/.gemini/config/mcp_config.json'))['mcpServers']['github-mcp-server']['env']['GITHUB_PERSONAL_ACCESS_TOKEN'])")
echo "$TOKEN" | docker login ghcr.io -u Cibi-M --password-stdin
unset TOKEN
```

Expected: `Login Succeeded`.

- [ ] **Step 2: If login fails**

The token likely lacks the `write:packages` scope (classic PAT) or `Packages: write` permission (fine-grained PAT). Stop here and report back — this requires the user to either update the token's permissions on GitHub or issue a new one; it's not something to work around silently.

---

### Task 5: Build and push both Docker images to GHCR

**Files:** none created/modified — uses the existing `backend/Dockerfile` and `frontend/Dockerfile`.

- [ ] **Step 1: Build the backend image**

```bash
docker build -t ghcr.io/expertly-network/expertly-backend:latest ./backend
```
Expected: build completes with `naming to ghcr.io/expertly-network/expertly-backend:latest done`.

- [ ] **Step 2: Build the frontend image with the production API URL baked in**

```bash
docker build -t ghcr.io/expertly-network/expertly-frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.expertly.network \
  ./frontend
```
Expected: build completes successfully, same naming confirmation.

- [ ] **Step 3: Push both images**

```bash
docker push ghcr.io/expertly-network/expertly-backend:latest
docker push ghcr.io/expertly-network/expertly-frontend:latest
```
Expected: both print a final digest line (e.g. `latest: digest: sha256:...`).

- [ ] **Step 4: Verify the packages are visible on GitHub**

Run: `gh api users/Cibi-M/packages?package_type=container --jq '.[].name' 2>&1 || echo "may require org package visibility check instead"`
Expected: lists `expertly-backend` and `expertly-frontend` (if pushed under Cibi-M's namespace) — if this returns empty/error because they landed under the `expertly-network` org namespace instead, that's fine; visually confirm via `https://github.com/orgs/expertly-network/packages` is out of scope for an automated check, just note it in the task report.

---

### Task 6: Snapshot and update DNS

**Files:** none — this is entirely MCP tool calls, no repo changes.

- [ ] **Step 1: Get the current DNS records for expertly.network**

Call `mcp__hostinger-dns__DNS_getDNSRecordsV1` for domain `expertly.network`. Note the existing A record's current value (the shared-hosting IP) for the report in Step 5.

- [ ] **Step 2: Take a DNS snapshot before changing anything**

Check `mcp__hostinger-dns__DNS_getDNSSnapshotListV1` for `expertly.network` — if Hostinger auto-snapshots on every change (likely), no explicit action is needed here; just confirm a snapshot exists after Step 3 that you could restore from (via `DNS_restoreDNSSnapshotV1`) if something goes wrong.

- [ ] **Step 3: Overwrite the root A record to point at the VPS**

Call `mcp__hostinger-dns__DNS_updateDNSRecordsV1` for `expertly.network`, setting the root (`@`) A record to `91.108.104.17`.

- [ ] **Step 4: Create the new api subdomain A record**

Call `mcp__hostinger-dns__DNS_updateDNSRecordsV1` (or the equivalent create path) for `expertly.network`, adding an A record for the `api` subdomain pointing at `91.108.104.17`.

- [ ] **Step 5: Verify both records via the API**

Call `mcp__hostinger-dns__DNS_getDNSRecordsV1` again for `expertly.network`. Expected: root A record now shows `91.108.104.17`; a new `api` A record also shows `91.108.104.17`.

Note: DNS propagation can lag actual resolution by minutes to hours — Task 8's `curl` checks may need re-running later if they fail with a connection error immediately after this task (that's expected, not a bug).

---

### Task 7: Deploy to the VPS

**Files:** none — reads `docker-compose.prod.yml` from Task 1 as input to an MCP call.

- [ ] **Step 1: Read the compose file content to pass as the deploy payload**

```bash
cat docker-compose.prod.yml
```
Use this exact text as the `content` argument below (not a GitHub URL — avoids the "resolves from `master` branch" limitation of that path entirely, since our default branch is `main`).

- [ ] **Step 2: Call the Hostinger deploy tool**

Call `mcp__hostinger-vps__VPS_createNewProjectV1` with:
- `virtualMachineId`: `1103127`
- `project_name`: `expertly-website`
- `content`: the full text of `docker-compose.prod.yml`
- `environment`: `BACKEND_PORT=4000\nFRONTEND_PORT=3000`

Expected: a success response (per the tool's docs, re-running this with the same `project_name` later replaces the existing project — that's the intended "manual redeploy" mechanism for future releases).

- [ ] **Step 3: Confirm the project is running**

Call `mcp__hostinger-vps__VPS_getProjectContentsV1` or `VPS_getProjectContainersV1` for `expertly-website` on VM `1103127`. Expected: three containers listed (`expertly-backend`, `expertly-frontend`, `expertly-caddy`), all in a running state.

- [ ] **Step 4: If any container isn't running**

Call `mcp__hostinger-vps__VPS_getProjectLogsV1` for `expertly-website` and read the logs for whichever container failed. Common causes to check for: image pull failure (Task 4/5 auth issue), Caddy failing to bind port 80/443 (something else already using it), or the backend/frontend crashing on start (check the log output directly rather than guessing).

---

### Task 8: End-to-end verification

**Files:** none.

- [ ] **Step 1: Check the backend health endpoint**

```bash
curl -s https://api.expertly.network/health
```
Expected: `{"status":"ok","uptime":<some number>}`. A connection timeout suggests DNS hasn't propagated yet or port 80/443 is blocked at the OS firewall level (see "Important context" above) — retry after a few minutes before escalating. A TLS/certificate error suggests Caddy hasn't finished issuing the cert yet — also worth a short retry.

- [ ] **Step 2: Check the frontend loads and successfully calls the backend**

```bash
curl -s https://expertly.network | grep -i "frontend is running"
```
Expected: matches the static badge text from the frontend's page (confirms the page rendered, not just that *some* page loaded).

- [ ] **Step 3: Confirm cross-service connectivity specifically (not just that both load independently)**

```bash
curl -s https://expertly.network | grep -i "hello from the backend"
```
Expected: matches the message the frontend fetched live from the backend's `/hello` endpoint — this is the actual proof the two containers can reach each other in production, matching the original scaffold's stated success criteria.

- [ ] **Step 4: Report final status**

Summarize: which URLs are live, any step that needed a retry/workaround, and confirm this matches `docs/deployment-guide-hostinger.md`'s Part 3 flow end-to-end.

---

## Self-review notes

- **Spec coverage:** registry (GHCR) → Task 4/5; domain overwrite + new subdomain → Task 6; secrets via Hostinger's `environment` field → Task 1 (interpolation) + Task 7 (the actual values); reverse proxy + auto-HTTPS → Task 1 (Caddy service); manual redeploy trigger → Task 7's `VPS_createNewProjectV1` call; initial push of untracked scaffold → Task 3. All covered.
- **Known open risk carried forward (not blocking):** whether Hostinger's "replace existing project" redeploy preserves named volumes (`caddy_data`/`caddy_config`) across redeploys, avoiding cert re-issuance every time. Task 8 verification will surface this the first time Task 7 is re-run for a future change — not testable before a real second deploy exists.
