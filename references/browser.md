# Browsers

Read exact fields/methods in ../local-api.yaml under /api/env and /api/cloudbrowser.
Use list/detail to resolve an exact profile. Start locally with envId; get the
actual debugPort from the response/status. Do not assume port 9222.
Status, detail, fingerprint refresh and local-cache shortcuts require envId.
Do not substitute a serial uniqueId. Browser list accepts pageSize up to 100.
Connect Playwright/Puppeteer to that existing runtime. Disconnect when finished;
do not close a user's existing profile unless asked.

Cloud start/stop is asynchronous. Poll cloudbrowser/page until RUNNING or the
documented terminal state, with a deadline. Connection URLs are short-lived
credentials. A force-stop requires --confirm-force-stop true.

Kernel download: browser kernel-download --browser-type 1 --version <version>.
Read available versions first. Payload Cores must have 1–20 items. The wrapper
allows 1810s, which exceeds the documented server wait; users can choose another
deadline. Browser startup defaults to 30s. Unknown outcomes require status reads.
