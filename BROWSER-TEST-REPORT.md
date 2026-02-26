# Browser ability special test report

- Test date: 2026-02-26
- Test object: `browser` command space of `bin/morelogin.js`
- Test environment: Native MoreLogin Local API (`http://127.0.0.1:40000`)
- Test method: real machine call + temporary profile closed-loop verification

---

## Test scope

According to the current CLI implementation, the following capabilities are tested one by one:

1. `browser list`
2. `browser create-quick`
3. `browser detail`
4. `browser refresh-fingerprint`
5. `browser start`
6. `browser status`
7. `browser clear-cache`
8. `browser close`
9. `browser delete`

---

## Test data

- Temporary profile envId: `2026914896828362752`
- This profile was created by `create-quick` and deleted after testing (recycle bin)

---

## Overview of results

| Capabilities | Results | Description |
|---|---|---|
| list | ✅ Return `total/dataList` via | Normal |
| create-quick | ✅ Passed | Successfully created temporary profile |
| detail | ✅ Pass | Return to full profile details |
| refresh-fingerprint | ✅ Return success (`null`) through | interface |
| start | ⚠️ Partially passed | First timeout, successful start after retry |
| status | ✅ Pass | Correctly returns stopped/running and debugPort |
| clear-cache | ❌ Failed | Returns `Please set the type of cache to be cleared` |
| close | ⚠️ Partially passed | The status may still be running for a short time after successful return |
| delete | ⚠️ The condition is passed | The deletion must be successful after the status is confirmed as stopped |

---

## Execution records one by one (key commands)

### 1) list

```bash
node bin/morelogin.js browser list --page 1 --page-size 3
```

- Result: ✅
- Key output: return `total: "11"` and `dataList`

### 2) create-quick

```bash
node bin/morelogin.js browser create-quick --browser-type-id 1 --operator-system-id 1 --quantity 1
```

- Result: ✅
- Key output: `["2026914896828362752"]`

### 3) detail

```bash
node bin/morelogin.js browser detail --env-id 2026914896828362752
```

- Result: ✅
- Key output: Return complete `advancedSetting/accountInfo/...`

### 4) refresh-fingerprint

```bash
node bin/morelogin.js browser refresh-fingerprint --env-id 2026914896828362752
```

- Result: ✅
- Key output: `✅ Fingerprint refresh completed`

### 5) start

```bash
node bin/morelogin.js browser start --env-id 2026914896828362752
```

- First result: ❌ `Request timeout after 10000ms`
- Retry result: ✅ Started successfully, returning `debugPort: "53133"`

### 6) status

```bash
node bin/morelogin.js browser status --env-id 2026914896828362752
```

- Result: ✅
- Key output: `status/localStatus/debugPort/webdriver` can be returned correctly

### 7) clear-cache

```bash
node bin/morelogin.js browser clear-cache --env-id 2026914896828362752
```

- Result: ❌
- Key output: `Please set the type of cache to be cleared`
- Explanation: The current CLI does not expose the "cache type" parameter and the capability is not available.

### 8) close

```bash
node bin/morelogin.js browser close --env-id 2026914896828362752
```

- Result: ⚠️ Partially passed
- Phenomenon: The interface returns success first, but then `status` may still show running; you need to wait and check again.

### 9) delete

```bash
node bin/morelogin.js browser delete --env-ids "2026914896828362752"
```

- First result: ❌ (profile still running)
- Try again after the status changes to stopped: ✅ Return `true`

---

## in conclusion

- `browser` reading ability is generally stable (`list/detail/status`).
- Lifecycle capabilities are available, but there are async consistency issues (`start/close/delete` requires retries or status polling).
- `clear-cache` is currently unavailable and is a major feature gap in this command space.

---

## Fix suggestions (by priority)

1. **P0: clear-cache parameter completion**
   - Add `--cache-types` (or equivalent parameters) to `browser clear-cache` and map it to the fields required by the official interface.

2. **P1: start/close enhanced to "eventual consistency" mode**
   - After `start` succeeds, poll `status` until running (or times out).
   - After `close` succeeds, poll `status` until stopped.

3. **P1: delete pre-verification**
   - Automatically check the status before deleting, and prompt/automatically close + wait if it is not stopped.

4. **P2: timeout configurable**
   - Support `--timeout-ms` to reduce false positive timeouts on slow machines.

---

## Fix supplementary validation (cache capability)

After re-correction based on the official document fields, the supplementary test has been passed:

- Local cache cleaning (`/api/env/removeLocalCache`)
  - Command: `node bin/morelogin.js browser clear-cache --env-id <envId> --cookie true --local-storage true`
  - Result: ✅ Return `envId/requestId`

- Cloud cache cleaning (`/api/env/cache/cleanCloud`)
  - Command: `node bin/morelogin.js browser clean-cloud-cache --env-id <envId> --cookie true --others true`
  - Result: ✅ Return success (`data: null`)
