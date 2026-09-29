# Quickstart

Install as described in [INSTALL.md](INSTALL.md), then:

```bash
node bin/morelogin.js api --endpoint /status --data '{}'
node bin/morelogin.js browser list --page 1 --page-size 20
node bin/morelogin.js cloudphone list --page 1 --page-size 20
node bin/morelogin.js cloudstorage info
node bin/morelogin.js account balance
```

To call any documented JSON endpoint:

```bash
node bin/morelogin.js api --endpoint /api/envtag/all --method GET
```

For an exact target from the list, use `browser detail --env-id <id>` or
`cloudphone info --id <id>`. Replace placeholders; keep large IDs as strings
in JSON. Do not assume a fixed CDP port; read it from runtime status.

Next: [usage](USAGE.md), [execution safety](references/safety.md).
