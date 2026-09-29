# MoreLogin Local API Skill

Agent instructions and a Node.js wrapper for the MoreLogin desktop Local API.
Includes a combined OpenAPI specification with **113 documented operations**.

The Skill name is `morelogin-local-api`. The existing npm package name
`morelogin-cli` and executable `morelogin` are retained for compatibility.
They are separate from the official `ml-cli` binary. This version has not been
published to npm merely because its package version is set to 1.1.0.

## Install from this repository

Requires Node.js 22.12+ and a running, logged-in MoreLogin desktop client.
The official API overview lists client 2.15.0+ as a baseline; availability of
individual newer routes depends on the installed client version.

```bash
git clone https://github.com/MoreLoginBrowser/morelogin-local-api-skill.git
cd morelogin-local-api-skill
node bin/morelogin.js help
node bin/morelogin.js api --endpoint /status --data '{}'
```

The wrapper uses Node built-ins and does not require npm packages at runtime.
For development and tests, use `npm ci`. To install the Skill, place this
repository's folder in your agent's skills directory, or select its root
`SKILL.md` with your agent's skill installer. Include its references, wrapper
and bundled OpenAPI; do not copy SKILL.md alone.

See [installation](INSTALL.md), [quickstart](QUICKSTART.md), [usage](USAGE.md)
and [the Skill entrypoint](SKILL.md).

## Capabilities

Browser profiles and cloud runtimes; cloud phones, apps, gestures, screenshots,
live streams, monthly plans; proxies, groups, tags, schedules; cloud storage;
wallet balance and webhooks. Named shortcuts cover common calls. The generic
`api` command covers other documented routes, including multipart upload.

```bash
node bin/morelogin.js browser list --page 1 --page-size 20
node bin/morelogin.js cloudphone list --page 1 --page-size 20
node bin/morelogin.js cloudstorage info
node bin/morelogin.js account balance
```

Use help for each command family. Destructive and security-sensitive operations
require matching confirmation flags, including generic API calls. See
[execution safety](references/safety.md). Default output is redacted.

## Development and release checks

```bash
npm ci
npm run validate
npm test
npm pack --dry-run
npm run verify:release
```

All 113 operations are tested against a local mock HTTP service with generated
schema-valid request fixtures. Negative tests exercise error responses,
confirmation, redaction, argument validation and timeouts. This does not prove
real server business behavior. See [test scope](references/testing.md).
Named command mappings have separate HTTP tests with independently specified
expected request bodies. Reports derive results from test events and explicitly
label missing/skipped/live-unverified cases. The installed tarball is tested
without development dependencies, including functional mock requests.

Official source snapshots, checksums and deterministic merge scripts are in
`specs/` and `scripts/`. See [OpenAPI provenance](references/openapi.md).
npm packing uses an explicit allowlist; unrelated local skills are excluded.

## Version 1.1.0

- Added 39 operations; merged four official specifications.
- Added cloud runtime/storage/phone command families, balance and webhooks.
- Unified confirmation, strict booleans, redaction and loopback-only transport.
- Preserved string IDs; added endpoint-specific timeouts and multipart upload.
- Reorganized agent references and added contract/transport and release CI tests.
- Hardened canonical route checks, Unicode decoding and total request deadlines.
- Added bounded streaming uploads, strict options and exact proxy-delete int64s.

The confirmation requirements are a deliberate behavior change for automation
that previously performed destructive actions without flags. Update scripts
after reviewing their exact targets; do not add confirmations indiscriminately.
Scripts that passed ignored or conflicting options now fail explicitly. Status
and detail shortcuts require envId; large proxy IDs remain exact on the wire.

Official docs: [API overview](https://guide.morelogin.com/api-reference/getting-started).
Report issues at [GitHub](https://github.com/MoreLoginBrowser/morelogin-local-api-skill/issues).
MIT licensed.
