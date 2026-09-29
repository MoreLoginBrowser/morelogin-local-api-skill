// Machine-readable test results; do not infer per-case success from exit code.
const path = require('node:path');
module.exports = async function* (events) {
  for await (const event of events) {
    if (['test:pass', 'test:fail'].includes(event.type)) {
      yield JSON.stringify({ type: event.type, name: event.data.name,
        skip: event.data.skip || false, todo: event.data.todo || false,
        durationMs: event.data.details?.duration_ms,
        error: event.data.details?.error?.message }) + '\n';
    }
    if (event.type === 'test:summary') yield JSON.stringify({ type: event.type,
      success: event.data.success, counts: event.data.counts, duration_ms: event.data.duration_ms,
      file: event.data.file ? path.basename(event.data.file) : undefined }) + '\n';
  }
};
