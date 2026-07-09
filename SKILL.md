---
name: morelogin
description: "Manage MoreLogin Desktop resources directly through the official Local API: browser profiles/environments, cloud phones, proxies, groups, tags, cloud phone schedules/RPA tasks, cloud storage files/labels, local API status, CDP debug ports, and multi-account automation. Use when the user mentions MoreLogin Local API, httpServer, 127.0.0.1:40000, envId/uniqueId/SN, browser profiles, cloud phones, schedules, cloud storage, proxies, groups, tags, CDP, ADB, or direct API automation."
metadata:
  openclaw:
    emoji: "🌐"
    requires:
      bins: ["node"]
    install:
      - id: npm
        kind: npm
        dir: ./
        label: Install MoreLogin Local API skill dependencies
      - id: adb
        kind: brew
        formula: android-platform-tools
        bins: ["adb"]
        label: Install ADB when cloud phone debugging requires it
---

# MoreLogin Local API Skill

Operate MoreLogin Desktop resources directly through the official localhost API. This skill is independent from the `morelogin-cli` / `ml-cli` skill; use this skill for direct HTTP/API workflows and use the CLI skill only when the user explicitly asks for CLI-based operation.

## Source Of Truth

- Official Local API docs: `https://guide.morelogin.com/api-reference/local-api`
- Base URL: `http://127.0.0.1:<port>`, usually `http://127.0.0.1:40000`
- Requirements: MoreLogin Desktop is installed, running, and logged in.
- Local API is localhost-only; do not assume remote network access.
- Treat `local-api.yaml`, `API-CONTRACT.md`, `README-OFFICIAL-API.md`, and developer route docs as the canonical parameter sources before constructing payloads.

## Preflight

Before any operation:

1. Confirm MoreLogin Desktop is running and logged in.
2. Confirm Local API reachability with `POST /status`.
3. Confirm the request is made from localhost.
4. For cloud phone ADB/debugging tasks, confirm ADB is available only when the task needs it.

Example:

```bash
curl -X POST "http://127.0.0.1:40000/status" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Execution Rules

- Prefer direct Local API calls or this project's Local API wrapper for this skill.
- Do not use `ml-cli` as the default path in this skill; it is a separate skill/tooling surface.
- Do not guess IDs, JSON fields, array/object shapes, or endpoint paths. Verify them from project docs before sending.
- Use `POST` unless the endpoint is documented as `GET`.
- Always send `Content-Type: application/json` for JSON requests.
- Inspect top-level response `code`; `0` means business success, non-zero means handle `msg`.
- Prefer `envId` for browser profile operations. Use profile `id` or `uniqueId` / SN only when the endpoint requires it.
- Batch endpoints require arrays; confirm target lists before delete, cache clear, proxy reassignment, app uninstall, schedule cancel, or cloud storage deletion.
- Redact proxy credentials, device identifiers, phone numbers, and ADB passwords by default in CLI/wrapper output. Use `--raw-output` only when the user explicitly needs the original Local API response.

Expected response shape:

```json
{
  "code": 0,
  "msg": null,
  "data": {},
  "requestId": "..."
}
```

## Browser Environment APIs

Core browser profile routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/env/page` | Paginated profile list |
| `POST` | `/api/env/detail` | Profile detail |
| `POST` | `/api/env/create/quick` | Quick create profile |
| `POST` | `/api/env/create/advanced` | Advanced create profile |
| `POST` | `/api/env/update` | Update profile |
| `POST` | `/api/env/removeToRecycleBin/batch` | Delete profiles to recycle bin |
| `POST` | `/api/env/start` | Start profile and return debug info |
| `POST` | `/api/env/close` | Close profile |
| `POST` | `/api/env/status` | Profile running status |
| `POST` | `/api/env/closeAll` | Close all active profiles |
| `POST` | `/api/env/removeLocalCache` | Clear local profile cache |
| `POST` | `/api/env/cache/cleanCloud` | Clear cloud cache |
| `POST` | `/api/env/fingerprint/refresh` | Refresh fingerprint |

Additional browser environment routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/env/getAllScreen` | Screen info |
| `POST` | `/api/env/arrangeWindows` | Arrange active windows |
| `POST` | `/api/env/getAllProcessIds` | Active profile process IDs |
| `POST` | `/api/env/getAllDebugInfo` | Debug info for active profiles |
| `GET` | `/api/env/advanced/ua/versions` | Browser core versions |
| `POST` | `/api/env/advanced/ua/get` | Generate/query UA |
| `POST` | `/api/env/base/resolution/list` | Available resolutions |
| `GET` | `/api/system/platform/list` | Available platforms |
| `POST` | `/api/env/lock/query` | Browser lock status |
| `POST` | `/api/env/base/list` | Timezone and language list |
| `POST` | `/api/env/base/mobile/devices` | Mobile device models |
| `POST` | `/api/env/setGroup/batch` | Batch set group |
| `POST` | `/api/env/setProxy/batch` | Batch set proxy |
| `POST` | `/api/env/setRemark/batch` | Batch set remark |

Typical browser automation workflow:

1. Use `/api/env/page` or `/api/env/detail` to identify the profile.
2. Use `/api/env/start` with `envId`, `id`, or `uniqueId` as required by the contract.
3. Use `/api/env/status` or start response data to get `debugPort` / CDP details.
4. Connect Playwright/Puppeteer to CDP.
5. Use `/api/env/close` when done.

CDP endpoints exposed by a started profile usually follow:

```text
http://127.0.0.1:<debugPort>/json/version
http://127.0.0.1:<debugPort>/json/list
ws://127.0.0.1:<debugPort>/devtools/browser/<browser_id>
```

## Cloud Phone APIs

Core cloud phone routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/cloudphone/page` | Paginated cloud phone list |
| `POST` | `/api/cloudphone/create` | Create cloud phone |
| `POST` | `/api/cloudphone/edit/batch` | Batch edit cloud phones |
| `POST` | `/api/cloudphone/delete/batch` | Batch delete cloud phones |
| `POST` | `/api/cloudphone/info` | Cloud phone detail |
| `POST` | `/api/cloudphone/brand/models` | Brand and model list; requires `skuId` |
| `POST` | `/api/cloudphone/powerOn` | Power on |
| `POST` | `/api/cloudphone/powerOff` | Power off |
| `POST` | `/api/cloudphone/newMachine` | Reset/new device |
| `POST` | `/api/cloudphone/updateAdb` | Enable/disable ADB |
| `POST` | `/api/cloudphone/exeCommand` | Execute cloud phone shell command |

Cloud phone file routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/cloudphone/uploadFile` | Upload local file to cloud phone |
| `POST` | `/api/cloudphone/upload/file/signedUrl` | Get temporary upload URL |
| `POST` | `/api/cloudphone/upload/file` | Upload file by URL |
| `POST` | `/api/cloudphone/upload/file/result` | Query upload result |
| `POST` | `/api/cloudphone/download` | Download file from cloud phone |
| `POST` | `/api/cloudphone/download/result` | Query download result |
| `POST` | `/api/cloudphone/setKeyBox` | Set Keybox |

Cloud phone app routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/cloudphone/app/install` | Install custom app |
| `POST` | `/api/cloudphone/app/page` | App market list |
| `POST` | `/api/cloudphone/app/installedList` | Installed app list |
| `POST` | `/api/cloudphone/app/start` | Start app |
| `POST` | `/api/cloudphone/app/restart` | Restart app |
| `POST` | `/api/cloudphone/app/stop` | Stop app |
| `POST` | `/api/cloudphone/app/uninstall` | Uninstall app |
| `POST` | `/api/cloudphone/app/setHideAccessibilityApp` | Hide accessibility app |

Cloud phone power-on can take 30-90 seconds. Use longer request timeouts for power-on/open workflows.
Treat `powerOn` success as an accepted startup request, not as proof that the device is ready for shell, app, reset, or file operations. After `powerOn`, poll `/api/cloudphone/info` every 10 seconds until `data.envStatus === 4` before calling `/api/cloudphone/exeCommand`, `/api/cloudphone/newMachine`, app start/stop/restart, upload/download, or other in-device actions. If a follow-up call returns `33301` with "The Cloud Phone has not been started up.", continue polling instead of failing immediately.

For `/api/cloudphone/edit/batch`, start with the smallest payload that satisfies the requested change. For example, remark-only edits should send `{ "id": [<cloudPhoneId>], "envRemark": "..." }`. If a combined edit containing `groupId`, `tags`, `proxyId`, geo, language, and remark fields returns HTTP 400, retry by splitting the edit into smaller calls and only include fields required for the current user request.

`/api/cloudphone/newMachine` is asynchronous. After it returns success, the cloud phone can report a resetting state and reject `powerOff` or `delete` with codes such as `33331` ("Cloud phone resetting, unable to shut down.") or `33327` ("Other members are using cloud phones and cannot be deactivated."). Do not stop at that response. Poll `/api/cloudphone/info` until the reset finishes, then retry `powerOff` and `delete` with a bounded wait.

Require explicit user confirmation before cloud phone delete, reset, power off, shell command execution, app uninstall, or other destructive/state-changing operations.

## Proxy, Group, And Tag APIs

Proxy routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/proxyInfo/page` | Proxy list |
| `POST` | `/api/proxyInfo/add` | Create proxy |
| `POST` | `/api/proxyInfo/update` | Update proxy |
| `POST` | `/api/proxyInfo/delete` | Delete proxy |

Group routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/envgroup/page` | Group list |
| `POST` | `/api/envgroup/create` | Create group |
| `POST` | `/api/envgroup/edit` | Edit group |
| `POST` | `/api/envgroup/delete` | Delete group |

Tag routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/envtag/all` | List all tags |
| `POST` | `/api/envtag/create` | Create tag |
| `POST` | `/api/envtag/edit` | Edit tag |
| `POST` | `/api/envtag/delete` | Delete tag |

Confirm before deleting or reassigning shared resources.

## Cloud Phone Schedule APIs

Use these routes for Cloud Phone RPA templates, tasks, and subtasks:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/cloudphone/rpa/template/market/page` | Market template list |
| `POST` | `/api/cloudphone/rpa/template/personal/page` | Personal template list |
| `POST` | `/api/cloudphone/rpa/task/page` | Schedule task list |
| `POST` | `/api/cloudphone/rpa/onceTask/save` | Create one-time task |
| `POST` | `/api/cloudphone/rpa/task/cancel` | Cancel task |
| `POST` | `/api/cloudphone/rpa/subTask/page` | Subtask list |
| `POST` | `/api/cloudphone/rpa/subTask/detail/{id}` | Subtask detail |
| `POST` | `/api/cloudphone/rpa/subTask/cancel/{id}` | Cancel subtask |

Use full JSON payloads for RPA task creation; do not infer nested task schemas from memory. Confirm before creating or canceling schedules.

## Cloud Storage APIs

Use cloud storage for MoreLogin shared files and labels:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/cloudstorage/info` | Storage quota and usage |
| `POST` | `/api/cloudstorage/file/page` | File list |
| `POST` | `/api/cloudstorage/upload/init` | Request presigned upload URL |
| `POST` | `/api/cloudstorage/upload/complete` | Confirm upload completion |
| `POST` | `/api/cloudstorage/file/delete/batch` | Delete files |
| `POST` | `/api/cloudstorage/file/tag/set` | Set labels, replacing existing labels |
| `POST` | `/api/cloudstorage/file/tag/add` | Add labels |
| `POST` | `/api/cloudstorage/file/tag/query` | Query file labels |
| `GET` | `/api/cloudstorage/tag/all` | List labels |
| `POST` | `/api/cloudstorage/tag/create` | Create label |
| `POST` | `/api/cloudstorage/tag/edit` | Edit label |
| `POST` | `/api/cloudstorage/tag/delete/batch` | Delete labels |

Upload flow:

1. Call `/api/cloudstorage/upload/init` with file name data.
2. Upload the binary to the returned `presignedUrl` with HTTPS `PUT`, including any returned headers.
3. Call `/api/cloudstorage/upload/complete` only after the PUT succeeds.

If the agent sandbox blocks external network access or HTTP PUT, ask for network approval or give the user the exact upload command to run locally.

Cloud Phone RPA can reference uploaded files with:

```text
morelogin://cloudfile?ids=<fileId>
morelogin://cloudfile?ids=<fileId1>,<fileId2>
```

Use English commas and preserve required RPA `__Extra__` file metadata.

## Keyword Lookup Pattern

When the user identifies a browser profile or cloud phone by name, group, tag, or remark:

1. Query the relevant list endpoint (`/api/env/page` or `/api/cloudphone/page`).
2. Match locally across name, group name, tag names, and remark when these fields are present in response data.
3. Operate only when exactly one candidate matches.
4. If zero or multiple candidates match, show candidates and ask the user which one to operate.

## Localhost And Sandbox Errors

If access fails with `connect EPERM 127.0.0.1:40000`, `connect EPERM 127.0.0.1:<debugPort>`, `connection refused`, `request timeout`, or an equivalent localhost error:

- Treat it as local sandbox permission or MoreLogin Desktop availability first.
- Request local access approval or elevated execution, then rerun the same operation.
- Do not repeatedly start the same profile/cloud phone after an EPERM error; check status first.

## Related Independent Skills And Tools

- `skills/morelogin-setup/SKILL.md`: prepares, installs, updates, or verifies MoreLogin Client and MoreLogin CLI on the machine.
- `morelogin-cli` / `ml-cli`: separate CLI-oriented skill/tool for users who explicitly want CLI-based MoreLogin operation.

Keep this Local API skill focused on direct HTTP API behavior and endpoint coverage. Do not make `ml-cli` a dependency or default execution path for this skill.

## When Not To Use This Skill

- MoreLogin Desktop is not installed, not running, or not logged in; use setup/install guidance first.
- The user explicitly asks to use `ml-cli`; use the CLI skill instead.
- The task is ordinary browser automation without MoreLogin environment isolation.
- The user expects remote access to the Local API over the network; MoreLogin Local API is localhost-only.

## Related Files

- `local-api.yaml`
- `API-CONTRACT.md`
- `README-OFFICIAL-API.md`
- `README.md`
- `skills/morelogin-setup/SKILL.md`
