function buildMatrix(events, operations, commandSurface = require('../bin/options').commands) {
  const cases = events.filter((e) => ['test:pass', 'test:fail'].includes(e.type));
  const state = (name) => {
    const found = cases.filter((e) => e.name === name);
    if (found.length !== 1) return 'not-run';
    const e = found[0];
    return e.skip ? 'skipped' : e.todo ? 'todo' : e.type === 'test:pass' ? 'pass' : 'fail';
  };
  const confirmations = require('../test/expected-confirmations');
  const rows = operations.map(({ route, method, multipart }) => ({ route, method, multipart,
    transport: Object.fromEntries(['success', 'business', 'http', ...(confirmations[route] ? ['confirmation'] : [])]
      .map((phase) => [phase, state(`transport ${method} ${route} :: ${phase}`)])),
    fixtureSource: 'bundled-request-schema', responseFixture: 'synthetic-transport-envelope',
    liveBusiness: 'not-run',
  }));
  const failed = cases.filter((e) => e.type === 'test:fail').length;
  const skipped = cases.filter((e) => e.skip || e.todo).length;
  const namedCommands = Object.entries(commandSurface).flatMap(([scope, group]) => Object.keys(group).map((command) => ({
    scope, command, status: state(scope === 'cloudphone' && command === 'adb-info'
      ? 'named cloudphone adb-info searches later pages and redacts credentials'
      : `named ${scope} ${command}: HTTP mapping and request contract`),
  })));
  return { generatedAt: new Date().toISOString(), mode: 'mock-contract-and-transport',
    runtime: process.version, platform: process.platform, testEvents: cases.length, failed, skipped,
    status: cases.length && !failed && !skipped && namedCommands.every((c) => c.status === 'pass') && rows.every((r) => Object.values(r.transport).every((s) => s === 'pass')) ? 'pass' : 'incomplete-or-failed',
    operations: rows, namedCommands };
}
module.exports = { buildMatrix };
