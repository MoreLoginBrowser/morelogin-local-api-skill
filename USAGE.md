# CLI usage

Run `node bin/morelogin.js help`. An optional global install exposes the same
wrapper as `morelogin`. It is separate from `ml-cli`.

## Commands

- Browser: list, start, close, status, detail, create-quick, refresh-fingerprint,
  clear-cache, clean-cloud-cache, delete, kernel-download.
- Cloud browser: start, stop, list, connect.
- Cloud phone: list, create, start, stop, info, adb-info, update-adb, new-machine,
  app-installed/start/stop/restart/uninstall, restart, reset, monthly-skus,
  monthly-activate, live-start/status/stop, team-apps, app-root, set-proxy,
  find-android, root, screenshot, screenshot-base64, adb-batch,
  tap, double-tap, long-press, swipe, drag.
- Cloud storage: info, list, upload-init, upload-complete, delete, set-tags,
  add-tags, file-tags, tag-list/create/edit/delete.
- Account: balance. Webhook: config.
- Proxy: list/add/update/delete. Group and tag: list/create/edit/delete.
- Generic: api --endpoint <documented-path> --method GET|POST --data '<json>'.

Use `cloudphone help`, `cloudstorage help`, `cloudbrowser help`,
`proxy help`, `group help`, `tag help`, `webhook help` or `account help`.

## Common options

`--payload` supplies JSON for named commands. `--data` is the generic
equivalent. `--page` and `--page-size` map to pageNo/pageSize; exceptions
such as app market pageNum require the generic endpoint's actual schema.

`--raw-output` defaults to false and is parsed as a strict boolean.
`--timeout-ms` overrides endpoint-specific timeouts. Base URL may be changed
with `MORELOGIN_LOCAL_API_URL`, but must remain an HTTP loopback address.

Timeout is a total HTTP deadline, not an idle timeout. The wrapper never retries
writes automatically. It accepts only documented method/path pairs and rejects
noncanonical paths (dot segments, encoded characters, duplicate/trailing slashes).
After updating the specification, regenerate the packaged route allowlist with
`node scripts/build-routes.js` (also run by `npm run sync:openapi`).

Unknown, duplicate, missing-value and conflicting options fail before HTTP.
Use `--payload` OR shortcut fields, not both. Browser status/detail/refresh and
local-cache shortcuts require `--env-id`; obtain it from `browser list` first.
Browser page size is 1–100. Proxy delete takes decimal ID strings at the CLI and
serializes exact int64 JSON number tokens without rounding them through Number.

Cloud phone startup accepts `--headless false` to display the window and
`--disable-money-saving-mode false`. Booleans must be explicit for these options.
Payload mode supports the corresponding `headless` and `disableMoneySavingMode`
fields. Omitted values retain API defaults; false is not treated as missing.

Uploads stream with backpressure; the default maximum is 512 MiB. Responses are
limited to 32 MiB and JSON request bodies to 1 MiB. Configure upload/response
bounds via `MORELOGIN_MAX_UPLOAD_BYTES` (up to 2 GiB) and
`MORELOGIN_MAX_RESPONSE_BYTES` (up to 512 MiB). Server limits may be lower.
Increase response bounds only when needed (e.g. large screenshots); responses
are parsed in memory. Uploading a file that changes while being read fails.

## Examples

```bash
node bin/morelogin.js browser create-quick --quantity 1
node bin/morelogin.js browser start --env-id 1993244721490239488
node bin/morelogin.js cloudphone info --id 1993244721490239488
node bin/morelogin.js cloudbrowser list --page 1 --page-size 20
node bin/morelogin.js cloudphone tap --id 1993244721490239488 --pos 10,20
node bin/morelogin.js cloudstorage set-tags --payload '{"fileId":"123","tagIds":[]}'
node bin/morelogin.js api --endpoint /api/cloudphone/uploadFile --data '{"id":"123"}' --file ./sample.txt
```

IDs above are examples, never automatic operation targets.
For a user-authorized delete, use the exact verified IDs and
`--confirm-delete true`. Other flags are documented in
[execution safety](references/safety.md).
A reset or reboot is asynchronous: poll documented status and stop at the
deadline rather than inferring completion from code 0.

Cloud Storage uploads use init → PUT → complete; see
[upload workflow](references/cloudstorage.md).
