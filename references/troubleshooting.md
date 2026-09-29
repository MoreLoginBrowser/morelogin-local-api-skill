# Troubleshooting

- EPERM to loopback: request local access permission and rerun the diagnostic
  read. Check status before retrying a write.
- ECONNREFUSED: verify the desktop client is running and the configured port.
  Do not assume permissions are the cause.
- Timeout/disconnect: outcome unknown. Inspect state; never automatically replay
  a non-idempotent operation.
- HTTP failure: retain status/code/requestId. Inspect server error text locally
  if necessary, without sharing secret values.
- Nonzero code: business failure even if HTTP 200. Missing numeric code or invalid
  JSON: invalid response, not success.
- Async pending: use bounded polling; report the actual observed state at expiry.
- Unsupported endpoint: check the installed client/version and official docs.
  Tests against a mock do not establish installed-client support.
