#!/usr/bin/env node

/**
 * OpenClaw MoreLogin skill entrypoint.
 *
 * Pass-through mode: forward all arguments directly to bin/morelogin.js.
 * This makes `openclaw morelogin ...` equivalent to:
 * `node bin/morelogin.js ...`
 */

const { spawn } = require('child_process');
const path = require('path');

const SKILL_DIR = __dirname;
const CLI_PATH = path.join(SKILL_DIR, 'bin', 'morelogin.js');
const forwardedArgs = process.argv.slice(2);

const child = spawn('node', [CLI_PATH, ...forwardedArgs], {
  stdio: 'inherit',
  cwd: SKILL_DIR,
});

child.on('error', (error) => {
  console.error(`❌ Failed to launch CLI: ${error.message}`);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
