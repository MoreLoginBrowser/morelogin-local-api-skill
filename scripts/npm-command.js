const fs = require('node:fs');
const path = require('node:path');
function npmCommand() {
  const candidates = [process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const bin = path.join(dir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    if (!fs.existsSync(bin)) continue;
    const real = fs.realpathSync(bin);
    if (real.endsWith('npm-cli.js')) candidates.push(real);
    candidates.push(path.join(dir, 'node_modules/npm/bin/npm-cli.js'));
  }
  const cli = candidates.find((p) => p && p.endsWith('npm-cli.js') && fs.existsSync(p));
  if (!cli) throw new Error('Cannot locate npm-cli.js. Run this check via npm run check:package.');
  return { executable: process.execPath, prefix: [cli] };
}
module.exports = { npmCommand };
