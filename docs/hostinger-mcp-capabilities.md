# Hostinger MCP Server — Capabilities

Your `~/.gemini/config/mcp_config.json` wires up **six** separate Hostinger MCP servers (all backed by the `hostinger-api-mcp` package, split by domain area). Each one exposes a different slice of the Hostinger API as tools. Below is what each server lets you (or an AI agent) do.

> Note: all of these require your Hostinger API token to be configured/authenticated for the MCP server — the config file shown only sets up the command/env, not credentials.

---

## 1. `hostinger-hosting` — Web Hosting Management

Manage shared/cloud hosting accounts, websites, and their infrastructure.

- **Websites**: create a website, list all websites, manage parked domains and subdomains for a website
- **Databases**: create/list/delete MySQL databases, change database passwords, manage remote database connections, repair a database
- **Cron jobs**: create, list, delete cron jobs; fetch cron job output/logs
- **PHP**: view PHP info/details, update PHP version, update/reset PHP extensions and options
- **Caching**: clear website cache, toggle website cache on/off, toggle "cacheless mode"
- **Node.js apps**: create a Node.js build from an archive, list builds, get build logs, restart a Node.js application
- **Static sites / JS apps**: deploy a static website, deploy a JS application, list JS deployments, view deployment logs
- **WordPress deploys**: deploy a WordPress plugin or theme, import a WordPress website
- **Domains/DNS-adjacent**: generate a free subdomain, verify domain ownership
- **Misc**: list orders, list available datacenters, get phpMyAdmin link

## 2. `hostinger-wordpress` — WordPress Site Administration

Deep WordPress-specific management on top of Hostinger-hosted WP installs.

- **Installations**: install WordPress, detect existing installs, list installations, validate installs, delete an installation, get JWT token / login links for an install
- **Plugins**: search, list installed/available/suggested plugins; install, activate, deactivate, uninstall, and update plugins (including the Hostinger plugin itself)
- **Themes**: list installed/available themes, install, activate, uninstall, update themes
- **Core**: show current WP core version, list available core updates, update WordPress core
- **Performance**: show/toggle LiteSpeed cache status and purge it, show/toggle Memcached object cache
- **Site state**: show/toggle maintenance mode
- **WooCommerce**: check if WooCommerce is installed
- **AI features**: show/set the "AI option" status for a site

## 3. `hostinger-domains` — Domain Registration & Management

- **Availability & purchase**: check domain availability, purchase a new domain
- **Details**: get domain details, list all domains you own
- **Nameservers**: update a domain's nameservers
- **WHOIS**: create/get/delete WHOIS profiles, check WHOIS profile usage
- **Domain locking**: enable/disable domain lock (transfer protection)
- **Privacy protection**: enable/disable WHOIS privacy protection
- **Forwarding**: create/get/delete domain forwarding (redirects)
- **Verification**: check domain ownership verification status (v2 endpoint)

## 4. `hostinger-dns` — DNS Record Management

- **Records**: get DNS records for a domain, update DNS records, delete DNS records, reset DNS records to default
- **Validation**: validate DNS records before applying them
- **Snapshots**: list DNS snapshots, get a specific snapshot, restore a domain's DNS from a snapshot (handy safety net before/after bulk DNS edits)

## 5. `hostinger-reach` — Email Marketing / Contact Management (Hostinger Reach)

- **Profiles**: list Reach profiles, check a profile's domain DNS status (for email deliverability/SPF-DKIM setup)
- **Contacts**: list contacts, create a single contact, bulk-create contacts, delete a contact
- **Segments**: create a contact segment, list segments, get segment details
- **Contact groups**: list contact groups
- **Segment contacts**: list contacts within a segment or profile segment

## 6. `hostinger-vps` — Virtual Private Server Management

The largest and most powerful set — full VPS lifecycle and infrastructure control.

- **VM lifecycle**: purchase a new VM, list VMs, get VM details, start/stop/restart a VM, recreate a VM, set up a purchased VM
- **Recovery**: start/stop recovery mode
- **Hostname**: get/set hostname, reset hostname
- **Access control**: create/list/get/delete SSH public keys, attach a public key to a VM, set root password, set panel password
- **Firewalls**: create a new firewall, list firewalls, get firewall details, activate/deactivate a firewall, create/update/delete firewall rules, sync firewall
- **Snapshots & backups**: create/get/delete a snapshot, restore from snapshot, list backups, restore a backup
- **Post-install scripts**: create/get/list/update/delete post-install automation scripts
- **Projects (Docker-based)**: create a new project, list projects, get project contents/containers/logs, start/stop/restart a project, delete a project
- **Monitoring**: get VM metrics, get security-scan metrics, get action history/details (audit log of operations)
- **Networking**: create/delete PTR (reverse DNS) records, set nameservers
- **Security**: install/uninstall Monarx (malware monitoring)
- **Templates & datacenters**: list OS templates, get template details, list available datacenters

---

## Practical examples of what you can ask for

- "Check if `example.com` is available and buy it if so, then point its DNS A record at my VPS IP."
- "List all my WordPress installations and update any plugins with available updates."
- "Create a snapshot of my VPS before I deploy, then deploy the new build."
- "Set up a firewall on my VPS that only allows SSH and HTTPS."
- "Add these 50 leads as contacts in Hostinger Reach and put them in a new segment."
- "Clear the cache on my website and check the current PHP version."

## Requirements / gotchas

- Each server needs the Hostinger API token available to the underlying `hostinger-api-mcp` process (typically via env var) — the JSON you shared only sets `USER_AGENT` and `PATH`, not the API key, so double check that's configured separately (often in a `.env` or additional `env` entry) or the tools will fail auth.
- Destructive actions exist here (delete VM/project/database, reset DNS, restore snapshot/backup) — treat them with the same care as any production infra change.
