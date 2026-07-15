# How Your Code Gets From Your Laptop To The Internet — Explained Simply

This document walks through **every single step** of getting your app live on
Hostinger, in plain English. If you've only deployed something 2-3 times
before, read this slowly, top to bottom — nothing is skipped, and every
technical term is explained the first time it shows up.

**The one-sentence version:** you write code → you turn it into a "shippable
box" (Docker image) → you put that box in a warehouse (container registry) →
you tell your server "go get the box from the warehouse and run it" → your
server runs it and the internet points at it.

Now let's slow that down.

---

## Part 0: The cast of characters (glossary)

Before the steps, here's what each piece of jargon means. Come back to this
section any time you hit a word you don't recognize.

| Term | What it actually means |
|---|---|
| **Repository (repo)** | A folder of code with its full history, stored on GitHub. Yours is `expertly-network/expertly-website`. |
| **Commit** | A saved snapshot of your code changes, with a message describing what changed. |
| **Push** | Uploading your commits from your laptop to GitHub. |
| **Docker** | A tool that packages your app (code + everything it needs to run: Node.js, dependencies, etc.) into one self-contained unit called an **image**. |
| **Docker image** | The "shippable box." A frozen, ready-to-run copy of your app. Doesn't change once built. |
| **Docker container** | A **running instance** of an image. If the image is a recipe, the container is the actual meal being cooked from it right now. |
| **Dockerfile** | The instructions for how to build an image (your repo already has one for `backend/` and one for `frontend/`). |
| **docker-compose.yml** | A file that says "run these containers together, on these ports, with these settings" — so you don't have to type long `docker run` commands by hand. |
| **Container registry** | A warehouse for Docker images. You upload ("push") an image there once, and any server can download ("pull") it later. We'll use **GitHub Container Registry (GHCR)**, since it's free and already tied to your GitHub account. |
| **VPS** | Virtual Private Server — your own private slice of a computer, always on, with its own IP address. You already have one: `srv1103127.hstgr.cloud` at IP `91.108.104.17`. |
| **DNS / A record** | The phonebook of the internet. An "A record" is the entry that says "when someone types `expertly.network`, send them to IP `91.108.104.17`." |
| **Reverse proxy** | A traffic director that sits in front of your containers. All public traffic hits it first; it decides which container (frontend or backend) should handle each request. We'll use **Caddy** because it also handles the next item automatically. |
| **HTTPS / TLS / SSL certificate** | The padlock icon in your browser. Without it, browsers warn "not secure." Caddy will get and renew this automatically for free (via Let's Encrypt) — you don't do anything manually. |
| **Environment variable / secret** | A config value (like a database password or API key) that shouldn't be hard-coded into your code. Passed in separately at run time. |

---

## Part 1: The big picture map

Here's the entire journey, as a straight line. Every step below the diagram
explains one arrow.

```
[Your laptop]
     |  1. write code
     v
[Local git repo]
     |  2. commit + push
     v
[GitHub: expertly-network/expertly-website]   <-- your code now lives here permanently
     |  3. docker build (on your laptop)
     v
[Docker images: expertly-backend, expertly-frontend]  <-- "shippable boxes", still on your laptop
     |  4. docker push
     v
[GitHub Container Registry (GHCR)]   <-- warehouse, images now stored online
     |  5. tell the VPS to redeploy (Hostinger MCP tool call)
     v
[Hostinger VPS pulls images from GHCR and starts containers]
     |  6. Caddy (reverse proxy) gets a free HTTPS certificate + routes traffic
     v
[https://expertly.network]  and  [https://api.expertly.network]
     |
     v
[Anyone in the world can now open the site in their browser]
```

Nothing skips a step. Code doesn't go straight from your laptop to the
internet — it always passes through GitHub (as source code) and GHCR (as a
built image) first.

---

## Part 2: One-time setup (you only do this once, ever)

These steps prepare the road. Once done, you never repeat them (unless
something changes, like moving to a new server).

### 2a. Point domain names at your server

Right now, if you type `expertly.network` in a browser, it goes to your
**shared hosting** (a different Hostinger product, not your VPS) — there's an
existing site there today. You've confirmed that site is safe to retire, so
we're fully switching the root domain over to the new app:

- `expertly.network` (root domain) → will show your frontend (the website
  people see)
- `api.expertly.network` (subdomain) → will serve your backend (data the
  frontend fetches)

This means two different kinds of DNS changes:

- **`expertly.network`**: an A record **already exists** here (pointing at
  shared hosting) — we're **overwriting** it to point at the VPS's IP
  `91.108.104.17` instead. Since this replaces a live record, I'll take a DNS
  snapshot first (Hostinger keeps these, and can restore one with a single
  call if anything looks wrong) before making the change.
- **`api.expertly.network`**: a **brand-new** A record, also pointing at
  `91.108.104.17`.

Both changes go through the `hostinger-dns` tool the moment you say go — it
takes seconds to apply, but can take a few minutes to a few hours to
"propagate" (spread across the internet) before it reliably works
everywhere. Until it propagates, the old shared-hosting site may
intermittently still appear to some visitors — this is normal and resolves
on its own.

### 2b. Add a "traffic director" (reverse proxy) to the deployment

Your `docker-compose.yml` currently runs the frontend on port 3000 and the
backend on port 4000 — but visitors can't type "port 3000" in their browser
comfortably, and there's no HTTPS padlock at all yet. So we add one more
container, **Caddy**, whose only job is:

- Listen on the standard web ports (80 for HTTP, 443 for HTTPS)
- When a request comes in for `expertly.network`, forward it to the
  frontend container
- When a request comes in for `api.expertly.network`, forward it to the
  backend container
- Automatically get and renew the HTTPS certificate for both domains, for
  free, with no manual steps

This means we need a **second compose file**, `docker-compose.prod.yml`,
specifically for the VPS deployment (your existing `docker-compose.yml` stays
untouched, for running things locally on your laptop).

### 2c. Why the production compose file looks different from the local one

This is the part that trips people up, so slow down here.

Locally, `docker-compose.yml` uses `build: ./backend` — meaning "build the
image right here, right now, from source code in this folder." That's fine
on your laptop because the source code is sitting right there.

But your Hostinger VPS deployment tool doesn't clone your GitHub repo — it
only reads a compose file and pulls **already-built images** by name from a
registry (like ordering a specific box from the warehouse by its label, not
asking the warehouse to build a new box for you). So `docker-compose.prod.yml`
uses `image: ghcr.io/expertly-network/expertly-backend:latest` instead of
`build: ./backend`.

That's *why* Part 1's diagram has a whole separate "build → push to GHCR"
stage before anything reaches the VPS — the VPS is only ever handed a
finished box, never raw ingredients.

---

## Part 3: Every time you want to ship a change (the repeatable loop)

Once the one-time setup above is done, here's what you'll actually do
*every single time* you make a change and want it live. Each of these
becomes a habit after a couple of repeats.

### Step 1 — Write and test your code locally

You edit `backend/` and/or `frontend/` code on your laptop, run it with
`pnpm dev` (as your README already describes), and check it works in your
browser at `localhost:3000`.

**Why this step matters:** never skip local testing — it's much faster to
catch a mistake here (seconds) than after it's deployed (minutes, and now
visible to whoever visits your site).

### Step 2 — Save your work to GitHub

```bash
git add .
git commit -m "describe what you changed"
git push origin main
```

**What this actually does:** `git add` stages your changes, `git commit`
saves a snapshot with a message, `git push` uploads that snapshot to GitHub
so it's not just sitting on your laptop anymore. Your repo currently has
*zero* commits pushed to GitHub — even your existing scaffold code
(backend/, frontend/, docker-compose.yml) is sitting locally, uncommitted.
**This first push hasn't happened yet — it's the very next thing to do.**

**Why this step matters:** GitHub is now the "source of truth" — the
permanent, shareable record of your code. It also means if your laptop dies
tomorrow, the code isn't lost.

### Step 3 — Turn your code into Docker images

```bash
docker build -t ghcr.io/expertly-network/expertly-backend:latest ./backend

docker build -t ghcr.io/expertly-network/expertly-frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.expertly.network \
  ./frontend
```

**What this actually does:** reads each `Dockerfile`, follows its
instructions (install dependencies, compile the code, assemble a lean runtime
image), and produces a named, versioned image sitting on your laptop.

**Why the frontend command has that extra `--build-arg` piece:** the
frontend "bakes in" the backend's URL at build time (so the browser knows
where to fetch data from) — it can't be changed later without rebuilding.
That's why it must point at the real public address
(`https://api.expertly.network`), not `localhost`, for production images.

**Why this step matters:** this is the step that actually catches "does my
code even compile/build correctly" — a second, independent check beyond your
local `pnpm dev` session.

### Step 4 — Upload (push) the images to the warehouse (GHCR)

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u Cibi-M --password-stdin
docker push ghcr.io/expertly-network/expertly-backend:latest
docker push ghcr.io/expertly-network/expertly-frontend:latest
```

**What this actually does:** `docker login` proves to GitHub's registry that
you're allowed to upload here (using the same GitHub account/token already
set up). `docker push` uploads each image so it now exists online, ready to
be pulled by any server — including your VPS.

**Why this step matters:** until this step, the image only exists on your
laptop. The VPS has never seen it and can't run it yet.

### Step 5 — Tell the VPS to redeploy

This is the "manual redeploy" step you chose — nothing happens automatically
on push; you (or I, when you ask) explicitly trigger this.

I'll call Hostinger's deployment tool (`VPS_createNewProjectV1`) with:
- Which VPS to deploy to (your existing one, ID `1103127`)
- A project name (so redeploying just replaces the same project instead of
  creating a duplicate)
- The contents of `docker-compose.prod.yml`
- The production secrets/config values (passed as environment variables at
  this step, per your earlier choice — never stored in the git repo)

**What this actually does, mechanically, on the VPS:** it reads the compose
file, sees three services need to run (backend, frontend, Caddy), **pulls**
the two images you just pushed to GHCR (downloading the finished "boxes"),
and starts all three as running containers.

**Why this step matters:** this is the actual "go-live" moment — before this,
nothing on the VPS has changed at all, no matter how many times you pushed to
GitHub or built images.

### Step 6 — Verify it actually worked

Open (or I'll check via `curl`):
- `https://expertly.network` — should show your frontend page
- `https://api.expertly.network/health` — should return
  `{ status: "ok", uptime: ... }`

**Why this step matters:** "I deployed it" and "it's actually working" are
different claims. Always confirm the second one before considering the job
done — a container can start and immediately crash, or Caddy can be
misconfigured, without any of the earlier steps showing an obvious error.

---

## Part 4: What happens when you want to change something later

Good news: once the one-time setup (Part 2) is done, shipping any future
change is *only* Part 3, Steps 1–6, repeated. The DNS records and Caddy
config from Part 2 don't need to be touched again unless you add a brand-new
subdomain or move to a different server.

---

## Part 5: What's deliberately NOT covered here

To keep this scaffold simple and understandable, we're intentionally not
doing (yet):

- **Automatic deployment on every push** — you explicitly chose "manual
  redeploy" for now. This can be added later as a separate, well-understood
  upgrade once you're comfortable with the manual flow.
- **A staging/test environment** — right now there's just one VPS and one
  live version. Common next step once the basics feel solid.
- **A database** — this scaffold has no database yet; today's backend just
  returns a hardcoded message.

---

## Quick reference: the shortest possible summary

1. Code → `git push` → GitHub (source of truth)
2. `docker build` → images on your laptop
3. `docker push` → images in GHCR (warehouse)
4. Tell Hostinger to redeploy → VPS pulls images, starts containers
5. Caddy handles HTTPS + routing automatically
6. Check `expertly.network` and `api.expertly.network` load correctly
