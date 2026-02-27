# Split Publish Guide

This workspace is split into two independently publishable skills.

## A) Local API Skill

Publish from project root:

```bash
clawhub publish . \
  --slug morelogin-local-api \
  --name "MoreLogin Local API Skill" \
  --version 1.1.0 \
  --tags latest \
  --changelog "Local API control plane release: Browser/CloudPhone/Proxy/Group/Tag lifecycle and operations."
```

## Notes

- `morelogin-local-api` is the control plane skill.
- `morelogin-assistant` is the browser execution plane skill.
- They can be installed independently or together.

