# MoreLogin Local API Skill Test Report

- Test date: 2026-02-26
- Test environment: macOS (darwin 25.3.0)
- Test directory: `skills/morelogin`
- Test method: CLI real-machine execution + official Local API connectivity verification

---

## 1. Test Conclusion (Summary)

- Overall conclusion: **Usable, but not recommended for direct release as "full capability completed"**
- Core read capabilities (browser/cloudphone/proxy/group/tag list/info): **Passed**
- Most write capability routes are connected, but parameter mapping issues exist: **Partially passed**
- Several "document-declared but CLI unimplemented" cloud phone capabilities: **Failed (not implemented)**

---

## 2. Baseline Connectivity

Execute:

- `node bin/test-api.js`

Results:

- `POST /api/env/page` Passed
- `POST /api/cloudphone/page` Passed
- `GET /api/envtag/all` Passed

Conclusion: Local API service is available, account is logged in, ready for actual testing.

---

## 3. Capability Test Results by Area

### 3.1 Browser Profile

- `browser list`：**Passed**
- `browser create-quick`：**Passed** (created temporary profile and recycled afterward)
- `browser start`：**Partially passed** (command reported `Request timeout after 10000ms`, but `status` then showed `running`)
- `browser status`：**Passed**
- `browser detail`：**Passed**
- `browser refresh-fingerprint`：**Passed**
- `browser clear-cache`：**Failed**
  - Symptom: Returned `Please set the type of cache to be cleared`
  - Conclusion: CLI does not encapsulate cache type parameter, making this capability unavailable
- `browser close`：**Passed**
- `browser delete`：**Passed**
  - Must stop before delete; first delete failed due to state not refreshing in time, second attempt succeeded

---

### 3.2 CloudPhone

Implemented and verified:

- `cloudphone list`：**Passed**
- `cloudphone info`：**Passed**
- `cloudphone exec`：**Passed** (executed `echo release_test` with output returned)
- `cloudphone app-installed`：**Passed**
- `cloudphone app-start/app-stop/app-restart/app-uninstall`：**Passed** (tested with non-existent package name, API callable and returns success)

Conditional verification (invalid ID, verified routing and error handling):

- `cloudphone start/stop/new-machine`：**Passed (error path)**
  - Returned `Cloud phone does not exist.`, indicating command reached target API

Failed items:

- `cloudphone update-adb`：**Failed**
  - Symptom: Returned `enableAdb: must not be null`
  - Conclusion: CLI currently sends field inconsistent with API expectation (`enable` vs `enableAdb`)

Unimplemented items (command does not exist):

- `cloudphone edit` (corresponds to `/api/cloudphone/edit/batch`)
- `cloudphone delete` (corresponds to `/api/cloudphone/delete/batch`)
- `cloudphone app-install` (corresponds to `/api/cloudphone/app/install`)
- `cloudphone app-page` (corresponds to `/api/cloudphone/app/page`)
- `cloudphone upload-file` (corresponds to `/api/cloudphone/uploadFile`)
- `cloudphone upload-status` (corresponds to `/api/cloudphone/uploadUrl`)
- `cloudphone set-keybox` (corresponds to `/api/cloudphone/setKeyBox`)

---

### 3.3 Proxy

- `proxy list`：**Passed**
- `proxy add`：**Passed** (created temporary proxy successfully)
- `proxy update`：**Passed**
- `proxy delete`：**Failed (CLI form)**
  - Symptom: `body: Http message not readable`
  - Conclusion: Delete payload structure sent by CLI does not match API requirement
  - Supporting evidence: Using `api` channel with "root array" payload (`["id"]`) can delete successfully

---

### 3.4 Group

- `group list`：**Passed**
- `group create --name ...`：**Failed**
  - Symptom: `groupName: Group name cannot be empty`
  - Conclusion: CLI field mapping error (should be `groupName`)
- `group create --payload {"groupName":...}`：**Passed**
- `group edit`：**Failed**
  - Symptom: Parameter validation inconsistent with API fields, cannot complete successful edit via CLI
- `group delete --ids ...`：**Passed** (temporary group recycled)

---

### 3.5 Tag

- `tag list`：**Passed**
- `tag create --name ...`：**Failed**
  - Symptom: `tagName: must not be blank`
  - Conclusion: CLI field mapping error (should be `tagName`)
- `tag create --payload {"tagName":...}`：**Passed**
- `tag edit`：**Failed**
  - Symptom: Same as above, field mapping mismatch causes edit failure
- `tag delete --ids ...`：**Passed** (temporary tag recycled)

---

### 3.6 Compatibility Commands and Generic API Mode

Compatibility commands:

- `list` / `info --profile-id` / `connect --profile-id`：**Passed**

Generic API mode:

- Documented usage `morelogin api --endpoint ...`：**Failed**
  - Symptom: `api mode requires --endpoint`
- Actual working usage `morelogin api call --endpoint ...`：**Passed**
  - Conclusion: Parameter parsing inconsistent with help documentation

---

## 4. Result Statistics

- Passed: 23
- Partially passed: 1
- Failed: 9
- Unimplemented: 7

> Note: Statistics count by "capability item", not by number of command invocations.

---

## 5. Release Risks and Recommendations

### Blocking (recommend fix before release)

1. `browser clear-cache` missing usable parameter encapsulation
2. `proxy delete` payload structure error
3. `group/tag` shorthand parameter field mapping errors for `create/edit`
4. `api` mode documentation inconsistent with actual invocation

### Important (recommend fix soon)

1. `cloudphone update-adb` field mapping error
2. Cloud phone file/application commands not implemented (`uploadFile/uploadUrl/setKeyBox/app/install/app/page`)
3. `cloudphone edit/delete` batch management not implemented

### Recommended Fix Order

1. Fix parameter mapping first (`group/tag/proxy/update-adb/api`)
2. Then add unimplemented commands (cloudphone batch/file/app install and market)
3. Finally add corresponding README/QUICKSTART regression verification commands

---

## 6. Notes

- Test process created temporary resources (browser profiles, group, tag, proxy) and they have been recycled.
- Sensitive fields in output (e.g., proxy authentication info) are not reproduced in plain text in this report.
