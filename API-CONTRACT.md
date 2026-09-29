# Local API contract

The bundled [local-api.yaml](local-api.yaml) is the single parameter source.
It combines four official OpenAPI 3.1 documents, version 2026-09-05. Provenance,
checksums, known source inconsistencies and synchronization instructions:
[OpenAPI reference](references/openapi.md).

There are 113 operations: JSON requests, GET requests, path-parameter requests
and one multipart upload. Do not infer HTTP method from the command's name.
Resource IDs in request objects are strings unless the exact schema says
otherwise. Never round an int64 ID through a JavaScript Number.
Unsafe integer tokens in responses are decoded as their exact source strings;
ordinary safe integers retain numeric types.
The proxy-delete shortcut serializes its documented integer-array request using
exact decimal JSON tokens; supply IDs as CLI strings. Generic --data rejects
unsafe numeric literals, so use the shortcut for proxy deletion with large IDs.

## Response

Business endpoints require HTTP 2xx and numeric `code === 0` for success.
The health endpoint `/status` is an explicit exception: HTTP 2xx and
`{"status":"ok"}` is its valid response.
Nonzero business codes, HTTP errors, malformed JSON and missing numeric codes
fail. Named commands display response data; generic calls display the envelope.
Error summaries retain HTTP status, code and requestId without echoing possible
secrets from server error messages.

## Generic calls

```bash
node bin/morelogin.js api --endpoint /api/envtag/all --method GET
node bin/morelogin.js api --endpoint /api/env/detail --data '{"envId":"1993244721490239488"}'
node bin/morelogin.js api --endpoint /api/cloudphone/uploadFile --data '{"id":"1993244721490239488"}' --file ./sample.txt
```

Replace path placeholders such as `{id}` with the verified target ID.
The generic transport deliberately preserves payload fields and does not claim
complete runtime JSON Schema validation. Consult the specification first.
Named commands add validation for common required fields.
Method/path pairs are checked against the packaged allowlist. A new server route
requires a reviewed contract/allowlist update, not a path bypass.

## Confirmation and timeouts

Confirmation policy is shared by every command through the HTTP boundary.
See [the exact flags](references/safety.md).
Default timeouts: browser start 30s, cloud phone powerOn 120s, kernel download
1810s, others 15s. Override with `--timeout-ms` or
`MORELOGIN_LOCAL_API_TIMEOUT_MS` (except the kernel-specific default, which
can be overridden with the flag). Timeout means unknown outcome, not failure
to execute. Check status before deciding whether a retry is safe.
The deadline covers the entire HTTP upload/response, even while bytes continue
arriving. For byte limits and streaming behavior see [usage](USAGE.md).
