# Cloud phones

Look up the exact schema in ../local-api.yaml. Keep IDs as decimal strings.
Startup is asynchronous: code 0 means accepted. Poll info until envStatus is 4
before apps, shell, gestures or files. Poll every 10 seconds for at most 120s;
on expiry report pending. Do not send another startup request blindly.
`cloudphone start --id <verified-id> --headless false` displays the window;
true hides it. Optional `--disable-money-saving-mode true|false` maps to the
documented boolean. Do not mix shortcut options with --payload.

ADB info resolves the exact ID across pages, capped at 100 pages / a 120-second
scan budget (plus at most one in-flight request). An incomplete/repeated page
response is reported as incomplete, not falsely as not found.

Restart/reset/newMachine/live operations may also be asynchronous. Poll their
documented info/status until success/failure or 5-minute deadline. Do not follow
reset with powerOff/delete unless those actions were explicitly requested.
In-use/permission errors are stop conditions; do not automatically force them.

Monthly activation charges the wallet. First read balance and monthly/skus,
resolve exact phones, confirm price/scope with the user if not already authorized,
and only then use --confirm-charge true.

For gestures use pos or pos1/pos2 from the current screen. Unknown outcomes need
screen inspection before retry. Root and ADB changes need --confirm-security true.
ADB credentials are sensitive and must not enter shared logs.

RPA: use full documented JSON for task/save or onceTask/save. Preserve __Extra__
metadata for cloud-file arguments and use morelogin://cloudfile?ids=<fileId>.
Schedules need --confirm-schedule true. Read templates before constructing inputs.
