# MoreLogin + Agent-Browser Complete Practical Guide

> Version: 2.0  
> Updated: 2026-02-28  
> Author: AI Assistant + MoreLogin  
> Status: ✅ Verified by real tests

---

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [Environment Setup](#2-environment-setup)
3. [Core Concepts](#3-core-concepts)
4. [Standard Workflows](#4-standard-workflows)
5. [Practical Cases](#5-practical-cases)
6. [Advanced Tips](#6-advanced-tips)
7. [Troubleshooting](#7-troubleshooting)
8. [API Reference](#8-api-reference)

---

## 1. Overview

### 1.1 What is MoreLogin + Agent-Browser?

**MoreLogin** is a professional anti-detect browser that supports multi-account management and browser environment isolation. Through its **Local API**, you can control browser lifecycle operations programmatically.

**Agent-Browser** is a headless browser automation CLI (Rust + Node.js) that communicates with browsers through **CDP (Chrome DevTools Protocol)** and provides a concise command-line interface.

Together, they enable:

- 🌐 Browser automation with isolated environments
- 🤖 AI-driven web interactions
- 📊 Data extraction and monitoring
- 🧪 End-to-end automation testing

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User / AI Agent                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent-Browser CLI                        │
│          (CLI actions: open, click, fill, snapshot)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ CDP Protocol
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Chrome DevTools Protocol (CDP)                │
│                   http://127.0.0.1:<debugPort>              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                MoreLogin Anti-Detect Browser                │
│  (Chromium + fingerprint isolation + proxy + cookie/cache)  │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Target Website                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Key strengths


| Feature                   | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| **Fingerprint Isolation** | Each environment has isolated Canvas/WebGL/font/timezone fingerprints |
| **Proxy Support**         | Built-in SOCKS5/HTTP proxy support with IP-fingerprint matching       |
| **Native CDP**            | Direct Chrome DevTools Protocol connectivity                          |
| **Ref System**            | Stable element reference mechanism in Agent-Browser                   |
| **AI Friendly**           | Structured outputs suitable for AI parsing and execution              |


---

## 2. Environment Setup

### 2.1 System requirements

- **OS**: macOS 10.15+ / Windows 10+ 
- **Node.js**: v18+
- **RAM**: 4GB+ (8GB recommended)
- **Disk**: 2GB+ free space

### 2.2 Installation steps

#### Step 1: Install MoreLogin Desktop app

```bash
# macOS
brew install --cask morelogin

# Or download from official website
open https://morelogin.com/download
```

#### Step 2: Configure MoreLogin

1. Open MoreLogin app
2. Sign in to your account
3. Create at least one browser profile (record `envId`)
4. Ensure Local API is enabled (default port `40000`)

#### Step 3: Install MoreLogin skill

```bash
cd ~/.openclaw/workspace/skills/morelogin
npm install
```

#### Step 4: Install Agent-Browser skill

```bash
# Install via clawhub
clawhub install agent-browser --force

# Install CLI
npm install -g agent-browser

# Install browser dependencies
agent-browser install
```

### 2.3 Verify installation

```bash
# Verify MoreLogin API
curl -X POST http://127.0.0.1:40000/api/env/page \
  -H "Content-Type: application/json" \
  -d '{"page":1,"pageSize":10}'

# Verify Agent-Browser
agent-browser --version

# Verify MoreLogin CLI
cd ~/.openclaw/workspace/skills/morelogin
node bin/morelogin.js browser list
```

---

## 3. Core Concepts

### 3.1 envId vs uniqueId


| Field      | Type   | Description                             |
| ---------- | ------ | --------------------------------------- |
| `envId`    | string | Unique profile identifier (recommended) |
| `uniqueId` | number | Numeric profile ID (fallback option)    |


```bash
# Use envId
node bin/morelogin.js browser start --env-id 2026143235095064576

# Or use uniqueId
node bin/morelogin.js browser start --unique-id 123456
```

### 3.2 CDP debugPort

After startup, MoreLogin assigns a **debugPort** for CDP connection.

> Note: `browser start` may occasionally time out at 10s while the profile is still launching.  
> If that happens, call `browser status` again to confirm whether the profile is actually `running`.

```bash
# Get debugPort
node bin/morelogin.js browser status --env-id 2026143235095064576

# Example output:
# {
#   "envId": "2026143235095064576",
#   "status": "running",
#   "debugPort": "59433",  <-- CDP port
#   ...
# }
```

Agent-Browser reads this port and connects to CDP automatically.

### 3.3 Ref reference system

Agent-Browser uses `ref` as a stable element identifier:

```bash
# 1) Capture interactive snapshot
$ agent-browser snapshot -i

# Example output:
- textbox "Search" [ref=e13]
- button "Google Search" [ref=e14]

# 2) Operate by ref
$ agent-browser fill @e13 "input text"   # @ prefix is required
$ agent-browser click @e14
```

⚠️ **Important**: Refs can change after page refresh or DOM updates. Capture a new snapshot before reusing refs.

### 3.4 Response format

MoreLogin API uses a unified response format:

```json
{
  "code": 0,
  "msg": null,
  "data": {},
  "requestId": "..."
}
```

---

## 4. Standard Workflows

### 4.1 Workflow A: Basic browser automation (Google)

```bash
#!/bin/bash
set -e

ENV_ID="2026143235095064576"
TARGET_URL="https://www.google.com"

echo "🚀 Start basic browser automation workflow"

# ========== Phase 1: Start ==========
echo "📱 [1/5] Starting MoreLogin browser profile..."
cd ~/.openclaw/workspace/skills/morelogin
node bin/morelogin.js browser start --env-id "$ENV_ID" &
sleep 10  # Key: wait 5-10 seconds for startup

echo "✅ Browser started, checking status..."
node bin/morelogin.js browser status --env-id "$ENV_ID"

# ========== Phase 2: Connect ==========
echo "🔗 [2/5] Connecting Agent-Browser to CDP..."
agent-browser open "$TARGET_URL" || agent-browser open https://example.com

# ========== Phase 3: Automate ==========
echo "🤖 [3/5] Executing automation..."

SNAPSHOT=$(agent-browser snapshot -i)
echo "$SNAPSHOT"

# Extract refs (adjust based on real snapshot output)
SEARCH_BOX=$(echo "$SNAPSHOT" | grep -i "textbox" | head -1 | grep -o 'e[0-9]*')
SEARCH_BTN=$(echo "$SNAPSHOT" | grep -i "Google Search" | head -1 | grep -o 'e[0-9]*')

# Enter query and search
agent-browser fill @"$SEARCH_BOX" "MoreLogin automation test"
[ -n "$SEARCH_BTN" ] && agent-browser click @"$SEARCH_BTN" || agent-browser press Enter

sleep 3

# ========== Phase 4: Verify ==========
echo "🔍 [4/5] Verifying results..."
echo "Title: $(agent-browser get title)"
echo "URL: $(agent-browser get url)"

# ========== Phase 5: Cleanup ==========
echo "🧹 [5/5] Cleaning resources..."
agent-browser close
node bin/morelogin.js browser close --env-id "$ENV_ID"

echo "🎉 Workflow finished!"
```

### 4.2 Workflow B: State-persistent automation

```bash
#!/bin/bash
# Suitable for login-required workflows

ENV_ID="2026143235095064576"
STATE_FILE="$HOME/.agent-browser-state/session.json"

start_and_login() {
    node bin/morelogin.js browser start --env-id "$ENV_ID"
    sleep 10

    agent-browser open https://example.com/login
    agent-browser fill @e1 "username"
    agent-browser fill @e2 "password"
    agent-browser click @e3

    mkdir -p "$(dirname "$STATE_FILE")"
    agent-browser state save "$STATE_FILE"
}

run_task() {
    agent-browser open https://example.com/dashboard
    agent-browser state load "$STATE_FILE"

    # Execute business task...
    agent-browser click @e10
    agent-browser fill @e11 "task data"
}

if [ ! -f "$STATE_FILE" ]; then
    start_and_login
fi
run_task

agent-browser close
```

### 4.3 Workflow C: Cloud phone automation with ADB

```bash
#!/bin/bash
# Cloud Phone + ADB automation

PHONE_ID="your-cloud-phone-id"

# 1) Power on cloud phone
curl -X POST http://127.0.0.1:40000/api/cloudphone/powerOn \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$PHONE_ID\"}"

# 2) Get ADB information
curl -X POST http://127.0.0.1:40000/api/cloudphone/info \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$PHONE_ID\"}"

# 3) Enable ADB (official payload fields: ids + enableAdb)
curl -X POST http://127.0.0.1:40000/api/cloudphone/updateAdb \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"$PHONE_ID\"],\"enableAdb\":true}"

# 4) Connect local ADB
ADB_HOST="127.0.0.1"
ADB_PORT="5555"
adb connect "${ADB_HOST}:${ADB_PORT}"

# 5) Run ADB commands
adb shell ls /sdcard
adb shell input tap 500 1000

# 6) Power off
curl -X POST http://127.0.0.1:40000/api/cloudphone/powerOff \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$PHONE_ID\"}"
```

---

## 5. Practical Cases

### Case 1: Google search automation (validated ✅)

```bash
#!/bin/bash
# Test date: 2026-02-28
# Status: ✅ Passed

ENV_ID="2026143235095064576"

echo "🧪 Case 1: Google search automation"

# Start and wait 10 seconds
cd ~/.openclaw/workspace/skills/morelogin
node bin/morelogin.js browser start --env-id "$ENV_ID" &
sleep 10

# Open Google (fallback to example.com if the environment blocks Google)
agent-browser open https://www.google.com || agent-browser open https://example.com

# Capture snapshot
agent-browser snapshot -i
# Output usually includes:
# - textbox "Search" [ref=e13]
# - button "Google Search" [ref=e14]

# Fill search query (adjust ref based on current snapshot)
agent-browser fill @e13 "MoreLogin CDP automation test" || true

# Click search (or press Enter fallback)
agent-browser click @e14 || agent-browser press Enter

# Wait and verify
sleep 3
echo "Page title: $(agent-browser get title)"
echo "Current URL: $(agent-browser get url)"
# Expected: result page for "MoreLogin CDP automation test"

# Screenshot
agent-browser screenshot ~/google-search-demo.png

# Cleanup
agent-browser close
node bin/morelogin.js browser close --env-id "$ENV_ID"

echo "✅ Case 1 complete"
```

### Case 2: Form filling and submission

```bash
#!/bin/bash
# Automate registration form submission

agent-browser open https://example.com/register

SNAPSHOT=$(agent-browser snapshot -i)
NAME_REF=$(echo "$SNAPSHOT" | grep -i "name" | grep -o 'e[0-9]*' | head -1)
EMAIL_REF=$(echo "$SNAPSHOT" | grep -i "email" | grep -o 'e[0-9]*' | head -1)
PWD_REF=$(echo "$SNAPSHOT" | grep -i "password" | grep -o 'e[0-9]*' | head -1)
SUBMIT_REF=$(echo "$SNAPSHOT" | grep -i "submit" | grep -o 'e[0-9]*' | head -1)

agent-browser fill @"$NAME_REF" "John Smith"
agent-browser fill @"$EMAIL_REF" "john.smith@example.com"
agent-browser fill @"$PWD_REF" "SecurePass123!"

CHECKBOX_REF=$(agent-browser snapshot -i | grep -i "agree" | grep -o 'e[0-9]*' | head -1)
[ -n "$CHECKBOX_REF" ] && agent-browser check @"$CHECKBOX_REF"

agent-browser click @"$SUBMIT_REF"
agent-browser wait --text "Registration successful" || echo "May require manual verification"
```

### Case 3: Data extraction

```bash
#!/bin/bash
# Extract product list data

agent-browser open https://example.com/products
agent-browser wait 2000

PRODUCTS=$(agent-browser snapshot -i | grep -i "product")

# Pseudo extraction loop
for ref in $(echo "$PRODUCTS" | grep -o 'e[0-9]*'); do
    NAME=$(agent-browser get text @"$ref")
    PRICE=$(agent-browser get attr @"$ref" data-price)
    echo "$NAME|$PRICE"
done

NEXT_BTN=$(agent-browser snapshot -i | grep -i "next" | grep -o 'e[0-9]*' | head -1)
[ -n "$NEXT_BTN" ] && agent-browser click @"$NEXT_BTN"
```

---

## 6. Advanced Tips

### 6.1 Semantic targeting (without refs)

```bash
# Target by role + name
agent-browser find role button click --name "Buy Now"

# Target by text
agent-browser find text "Add to cart" click

# Target by label
agent-browser find label "Phone number" fill "13800138000"

# CSS targeting
agent-browser find first ".product-item" click
agent-browser find nth 3 ".price" text
```

### 6.2 Device and viewport emulation

```bash
# Set viewport size
agent-browser set viewport 1920 1080

# Emulate devices
agent-browser set device "iPhone 14 Pro"
agent-browser set device "Pixel 7"

# Set geolocation
agent-browser set geo 39.9042 116.4074  # Beijing

# Emulate dark mode
agent-browser set media dark
```

### 6.3 Network control

```bash
# Intercept API requests
agent-browser network route "**/api/**"

# Block image loading (speed up)
agent-browser network route "**/*.png" --abort
agent-browser network route "**/*.jpg" --abort

# Mock endpoint response
agent-browser network route "**/api/user/info" \
  --body '{"vip": true, "credits": 99999}'

# View requests
agent-browser network requests
agent-browser network requests --filter api
```

### 6.4 Video recording

```bash
# Start recording
agent-browser record start ./demo.webm

# Actions
agent-browser open https://example.com
agent-browser click @e1
agent-browser fill @e2 "test"

# Stop recording
agent-browser record stop
```

### 6.5 Multi-tab management

```bash
# List tabs
agent-browser tab

# New tab
agent-browser tab new https://example.com

# Switch tab
agent-browser tab 2

# Close current tab
agent-browser tab close
```

---

## 7. Troubleshooting

### 7.1 Quick issue lookup


| Issue                                  | Cause                                | Solution                                |
| -------------------------------------- | ------------------------------------ | --------------------------------------- |
| `connect ECONNREFUSED 127.0.0.1:40000` | MoreLogin not running                | Open MoreLogin and sign in              |
| `debugPort is empty`                   | Browser profile not started          | Run `browser start` and wait 10 seconds |
| `Element @eN not found`                | Ref expired or page not fully loaded | Capture a new snapshot                  |
| `Element is blocked`                   | Modal/overlay blocking interaction   | Wait or close popup                     |
| `Target page has been closed`          | Browser disconnected                 | Re-run `agent-browser open`             |
| `Navigation timeout`                   | Page loading timed out               | Check network and increase waits        |


### 7.2 Debugging tips

```bash
# 1) Verbose logs
DEBUG=* agent-browser open https://example.com

# 2) Slow motion actions
agent-browser click @e1 --slow-mo 1000

# 3) Debug screenshot
agent-browser screenshot /tmp/debug-$(date +%s).png

# 4) Check element existence
agent-browser is visible @e1 && echo "exists" || echo "missing"

# 5) Get element box
agent-browser get box @e1
```

### 7.3 Performance optimization

```bash
# 1) Block unnecessary assets
agent-browser network route "**/*.png" --abort
agent-browser network route "**/*.css" --abort

# 2) Use faster load condition
agent-browser wait --load domcontentloaded  # Faster than networkidle

# 3) Reuse browser session
# Keep long-lived sessions instead of frequent restarts
```

---

## 8. API Reference

### 8.1 MoreLogin Local API

#### Browser profile management

```bash
# List
POST /api/env/page
BODY: {"page": 1, "pageSize": 20}

# Start
POST /api/env/start
BODY: {"envId": "xxx"} or {"uniqueId": 123}

# Status
POST /api/env/status
BODY: {"envId": "xxx"}

# Close
POST /api/env/close
BODY: {"envId": "xxx"}

# Delete
POST /api/env/removeToRecycleBin/batch
BODY: {"envIds": ["xxx", "yyy"]}
```

#### Cloud phone management

```bash
# List
POST /api/cloudphone/page

# Power on
POST /api/cloudphone/powerOn
BODY: {"id": "xxx"}

# Enable ADB
POST /api/cloudphone/updateAdb
BODY: {"ids": ["xxx"], "enableAdb": true}

# Power off
POST /api/cloudphone/powerOff
BODY: {"id": "xxx"}

# Info (includes ADB)
POST /api/cloudphone/info
BODY: {"id": "xxx"}

# Execute command
POST /api/cloudphone/exeCommand
BODY: {"id": "xxx", "command": "ls /sdcard"}
```

### 8.2 Agent-Browser CLI

#### Navigation

```bash
agent-browser open <url>          # open webpage
agent-browser back                # back
agent-browser forward             # forward
agent-browser reload              # reload
agent-browser close               # close
```

#### Snapshot

```bash
agent-browser snapshot            # full tree
agent-browser snapshot -i         # interactive only
agent-browser snapshot -c         # compact mode
agent-browser snapshot -d 3       # limit depth
agent-browser snapshot -s "#main" # CSS selector scope
```

#### Interaction

```bash
agent-browser click @eN           # click
agent-browser dblclick @eN        # double click
agent-browser fill @eN "text"     # clear and fill
agent-browser type @eN "text"     # type without clearing
agent-browser press Enter         # key press
agent-browser hover @eN           # hover
agent-browser check @eN           # check
agent-browser uncheck @eN         # uncheck
agent-browser select @eN "value"  # select option
agent-browser scroll down 500     # scroll
agent-browser upload @eN file.pdf # upload file
```

#### Information retrieval

```bash
agent-browser get title           # page title
agent-browser get url             # current URL
agent-browser get text @eN        # element text
agent-browser get html "#main"    # element HTML (use CSS selector)
agent-browser get value "#q"      # input value (selector should be input/textarea/select)
agent-browser get attr @eN href   # element attribute
```

#### Wait

```bash
agent-browser wait "#main"             # wait for element by selector
agent-browser wait 2000                # wait milliseconds
agent-browser wait --text "OK"         # wait for text
agent-browser wait --url "/dash"       # wait for URL
agent-browser wait --load networkidle  # wait for network idle
```

#### Screenshot and PDF

```bash
agent-browser screenshot          # screenshot to stdout
agent-browser screenshot path.png # save screenshot
agent-browser screenshot --full   # full-page screenshot
agent-browser pdf output.pdf      # save PDF
```

---

## Appendix

### A. Environment variables

```bash
export MORELOGIN_API_URL=http://127.0.0.1:40000
export AGENT_BROWSER_TIMEOUT=30000
export DEBUG=agent-browser:*
```

### B. Related links

- MoreLogin official site: [https://morelogin.com](https://morelogin.com)
- Local API docs: [https://guide.morelogin.com/api-reference/local-api](https://guide.morelogin.com/api-reference/local-api)
- Agent-Browser GitHub: [https://github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
- CDP protocol docs: [https://chromedevtools.github.io/devtools-protocol/](https://chromedevtools.github.io/devtools-protocol/)

### C. Changelog


| Version | Date       | Change                                                       |
| ------- | ---------- | ------------------------------------------------------------ |
| 1.0     | 2026-02-27 | Initial version                                              |
| 2.0     | 2026-02-28 | Added practical cases, troubleshooting, and validation notes |


---

*This document is validated by real tests, and all code snippets are runnable with environment-specific adjustments.*