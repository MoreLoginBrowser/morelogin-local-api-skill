# Test scope

npm test runs all 113 documented operations through the CLI and a loopback mock
server. Fixtures are generated from official schemas; their request shapes are
checked with JSON Schema validation, subject to explicitly recorded upstream
schema exceptions. Tests assert method, path, payload, response parsing,
HTTP/business failure, redaction, multipart bytes and confirmation behavior.

These tests verify generic request transport and bundled request fixtures, not
complete server response schemas or business behavior. Named-command HTTP cases
independently check exact paths, methods and payloads. Additional workflow mocks
cover accepted/pending/ready/error states and paginated ADB lookup. They verify
what the wrapper reports, not actual device transitions. Never report this as
113 live API tests.

Run `npm run verify:release`. `reports/test-events.jsonl` records test events;
`reports/endpoint-matrix.json` derives each phase's status from those events.
Missing, skipped or failed phases cannot become passes. Test-event counts include
parent tests and subtests; they are not endpoint counts. Request/response schema
exceptions remain recorded separately. Confirmation expectations are maintained
independently from production policy to detect accidentally removed guards.

`scripts/check-package.js` installs the tarball without dev dependencies and runs
help plus functional HTTP mocks. It invokes npm via Node, not a platform shell.
After authorizing read-only integration tests, run
`node scripts/live-package-readonly.js --run`. This tests the installed project
tarball against the running client and writes safe summary fields only. It never
runs as part of default tests/CI, and does not replace workspace CLI routing for
ordinary resource operations. `scripts/live-readonly.js` is the older official
ml-cli preflight, not evidence about this wrapper.

Stable-release gates: all local tests; Node 22/24 on Linux/macOS/Windows CI;
installed-package live read-only checks; separately authorized representative
write/async/upload acceptance on disposable resources. Record unexecuted cases
honestly. Mock passes or a subjective score cannot waive a release gate.

Real verification requires a logged-in client and disposable resources. Read-only
preflight is separate. Paid activation, deleting/resetting devices, Root/ADB,
shell, proxy changes, live streams, schedules and file deletion require exact
test targets and explicit user authorization before a live test. Record client
version, targets, expected/actual state and cleanup per case.
