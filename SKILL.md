---
name: morelogin-local-api
description: Operate MoreLogin browser profiles, cloud phones and shared resources through the official localhost API. Use for MoreLogin direct API requests, payloads, integration and debugging. Follow user or workspace CLI routing instructions when present; ordinary web browsing does not require this skill.
---

# MoreLogin Local API

Use the desktop Local API at `http://127.0.0.1:40000` (configurable port).
MoreLogin must be running and logged in. This repository's Node wrapper is
`morelogin`; the separate official CLI is `ml-cli`. Existing workspace and
user routing requirements take precedence. Never substitute one without checking.

## Choose the reference

- [API contract](API-CONTRACT.md): authoritative bundled schemas and generic request syntax.
- [Browser](references/browser.md): profiles, cloud runtimes, CDP and kernel downloads.
- [Cloud phones](references/cloudphone.md): startup, reset, apps, gestures and schedules.
- [Cloud storage](references/cloudstorage.md): upload transaction and labels.
- [Execution safety](references/safety.md): confirmation flags, retry rules and secrets.
- [Troubleshooting](references/troubleshooting.md): permissions, timeouts and business errors.
- [CLI usage](USAGE.md): named commands and generic endpoint access.
- [Test scope](references/testing.md): release verification and limits of mock/live evidence.
- [Setup](skills/morelogin-setup/SKILL.md): only when client installation is needed.

Read the relevant domain reference and execution safety before mutations.
Look up exact request fields in `local-api.yaml`; it contains 113 operations.
The wrapper has named shortcuts for common calls and generic transport for the
remaining routes, including multipart uploads. Do not claim all routes have
dedicated subcommands.

## Workflow

1. If workspace rules require `ml-cli`, follow those rules. Otherwise check
   `POST /status` before direct API operations.
2. Resolve the requested resource from list/detail endpoints. When a name,
   group, tag or remark is used, search all relevant pages. Act only on an exact
   unambiguous match; ask for the target when none or multiple match.
3. Read the request schema and operation description. Keep 64-bit resource IDs
   as strings; never convert them to JavaScript numbers.
   Browser status/detail/local-cache shortcuts require envId, not uniqueId.
   Unknown or conflicting CLI flags fail; do not combine payload and shortcuts.
4. Use only operations necessary for the user's request. Existing authorization
   for the same exact action counts; do not ask again. Confirmation flags record
   that authorization and do not grant it.
5. Check both HTTP status and numeric `code === 0`. Retain code/requestId for
   diagnostics. A successful asynchronous request is accepted, not completed.
6. Verify completion with documented read-only status calls. Limit polling to
   120 seconds for startup and 5 minutes for other async jobs unless the user
   specifies a different deadline. Report pending state on expiry.
7. Summarize targets, accepted/completed/failed state and remaining uncertainty.

Do not replay state-changing requests after timeout or disconnect. Read status
first. Do not delete or power off a device as an automatic follow-up to reset.
An in-use or permission error is a stop condition, not permission to force.

## Output

Secrets, cookies, OTP seeds, device identifiers and connection URLs are redacted
by default. Use raw output only for the specific authorized workflow that needs
it, keep it local, and never echo credentials into shared logs or reports.

## Boundaries

A request to list, inspect, diagnose or test does not authorize paid activation,
deletion, reset, shell execution, Root/ADB changes or live destructive tests.
Mock tests are suitable for these without changing user resources.
Ordinary profile startup does not authorize shutting down an existing user
session afterwards. Close only resources the task created/opened when needed.
