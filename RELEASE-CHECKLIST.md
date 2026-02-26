# MoreLogin Skill Pre-Release Checklist

For quick verification before each release: documentation, CLI commands, official Local API coverage, examples, and regression verification are consistent.

> Recommend checking off each item on the release branch; do not skip steps.

---

## 0) Release Information

- [ ] Version number determined (e.g., `vX.Y.Z`)
- [ ] Release date recorded
- [ ] Scope of changes recorded (features/fixes/documentation)
- [ ] Compatibility notes confirmed (whether there are breaking changes)

---

## 1) Code and Command Alignment

### 1.1 CLI Entry and Structure

- [ ] `bin/morelogin.js` is executable and syntactically correct
- [ ] `bin/common.js` request wrapper and error handling work
- [ ] `bin/cloudphone.js` proxy forwarding logic works
- [ ] `bin/test-api.js` usable for local API connectivity self-check
- [ ] `bin/start-profile.js` uses official `envId` parameter

### 1.2 Command Namespace Coverage

- [ ] `browser` commands available (`list/start/close/status/detail/create-quick/refresh-fingerprint/clear-cache/delete`)
- [ ] `cloudphone` commands available (`list/create/start/stop/info/exec/update-adb/new-machine/app-*`)
- [ ] `proxy` commands available (`list/add/update/delete`)
- [ ] `group` commands available (`list/create/edit/delete`)
- [ ] `tag` commands available (`list/create/edit/delete`)
- [ ] Legacy commands compatible (`list/start/stop/info/connect`)

### 1.3 Help Information

- [ ] `node bin/morelogin.js help` includes all command namespaces
- [ ] `node bin/morelogin.js proxy help` works
- [ ] `node bin/morelogin.js group help` works
- [ ] `node bin/morelogin.js tag help` works
- [ ] `node bin/cloudphone.js help` works

---

## 2) Official Local API Alignment

### 2.1 Base URL and Protocol

- [ ] Default API address is `http://127.0.0.1:40000`
- [ ] Supports override via environment variable (e.g., `MORELOGIN_LOCAL_API_URL`)
- [ ] Default request header is `Content-Type: application/json`

### 2.2 Endpoint Coverage Verification

- [ ] Browser endpoints match official (`/api/env/*`)
- [ ] CloudPhone endpoints match official (`/api/cloudphone/*`)
- [ ] Proxy endpoints match official (`/api/proxyInfo/*`)
- [ ] Group endpoints match official (`/api/envgroup/*`)
- [ ] Tag endpoints match official (`GET /api/envtag/all`, `POST /api/envtag/*`)

### 2.3 Response Handling Standards

- [ ] Uniformly judge success/failure by `code/msg/data`
- [ ] Output readable error info on failure (including `msg`)
- [ ] HTTP non-2xx handling is correct
- [ ] Fallback output when JSON parse fails

---

## 3) Documentation Alignment

### 3.1 Core Document Consistency

- [ ] `SKILL.md` capability scope matches current CLI
- [ ] `README.md` example commands can run directly
- [ ] `QUICKSTART.md` example commands can run directly
- [ ] `README-OFFICIAL-API.md` matches official documentation
- [ ] `INSTALL.md` installation steps match current dependencies

### 3.2 No Obsolete Commands in Documentation

- [ ] No deprecated command examples (e.g., old parameter names)
- [ ] No non-existent script entry points or file paths
- [ ] No parameter examples conflicting with current CLI

### 3.3 New Capability Documentation Coverage

- [ ] Proxy capabilities documented in README/QUICKSTART
- [ ] Group capabilities documented in README/QUICKSTART
- [ ] Tag capabilities documented in README/QUICKSTART

---

## 4) Local Regression Verification (Minimum Set)

> Run minimum regression at least once before release. Recommended to run the following commands one by one and confirm success.

### 4.1 Syntax Check

- [ ] `node --check bin/common.js`
- [ ] `node --check bin/morelogin.js`
- [ ] `node --check bin/cloudphone.js`
- [ ] `node --check bin/start-profile.js`
- [ ] `node --check bin/test-api.js`

### 4.2 API Connectivity

- [ ] `node bin/test-api.js` passes core checks
- [ ] MoreLogin Desktop is running and logged in
- [ ] `127.0.0.1:40000` is reachable from this machine

### 4.3 Command Smoke Test

- [ ] `node bin/morelogin.js browser list`
- [ ] `node bin/morelogin.js cloudphone list`
- [ ] `node bin/morelogin.js proxy list`
- [ ] `node bin/morelogin.js group list`
- [ ] `node bin/morelogin.js tag list`

---

## 5) Release Artifact Check

- [ ] `package.json` version matches release plan
- [ ] Required files included (`bin/*`, `README.md`, `SKILL.md`, `QUICKSTART.md`)
- [ ] Files that should not be released are excluded (temp scripts, debug output, sensitive info)
- [ ] Changelog updated (if applicable)

---

## 6) Post-Release Acceptance (Optional but Recommended)

- [ ] Do full install once in clean environment per `INSTALL.md`
- [ ] Run `node bin/morelogin.js help` in new environment
- [ ] Run through minimum flow per `QUICKSTART.md`
- [ ] Random spot-check one `proxy/group/tag` command

---

## One-Click Review Commands (Copy-Paste Ready)

```bash
node --check bin/common.js && \
node --check bin/morelogin.js && \
node --check bin/cloudphone.js && \
node --check bin/start-profile.js && \
node --check bin/test-api.js && \
node bin/morelogin.js help && \
node bin/morelogin.js proxy help && \
node bin/morelogin.js group help && \
node bin/morelogin.js tag help
```
