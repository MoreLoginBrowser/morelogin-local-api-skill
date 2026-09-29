# Installation

Requires Node.js 22.12+; MoreLogin desktop must be running and logged in.

## From GitHub

```bash
git clone https://github.com/MoreLoginBrowser/morelogin-local-api-skill.git
cd morelogin-local-api-skill
node bin/morelogin.js help
```

No runtime npm dependency is required. Optional global installation from this
checkout: `npm install --global .`. This changes your machine's command PATH
and should only be done when requested. The installed executable is `morelogin`.

For agent discovery, install the repository root as a Skill folder named
`morelogin-local-api`, including `references/`, `bin/` and `local-api.yaml`.
The root agent UI metadata is `agents/openai.yaml`. Installation mechanics
depend on the agent; the repo does not register an `openclaw morelogin` command.

Client installation is described in [setup](skills/morelogin-setup/SKILL.md).
The official `ml-cli` is optional for direct API use, but workspace rules may
require it. For direct API users, skip CLI installation and verify the client
with `POST /status`. Complete OS/login prompts personally.

## Development

```bash
npm ci
npm run validate
npm test
```

Node dependencies are development-only. Browser automation examples require
Playwright or Puppeteer from these development dependencies; the wrapper itself
does not install or download another browser.
