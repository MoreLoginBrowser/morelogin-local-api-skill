const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();

function confirmationFlag(endpoint) {
  if (endpoint === '/api/cloudphone/monthly/activate') return 'confirm-charge';
  if (endpoint === '/api/env/closeAll') return 'confirm-close-all';
  if (/delete|removeToRecycleBin/i.test(endpoint)) return 'confirm-delete';
  if (/\/(reset|newMachine)$/.test(endpoint)) return 'confirm-reset';
  if (/\/powerOff$/.test(endpoint)) return 'confirm-power-off';
  if (/\/uninstall$/.test(endpoint)) return 'confirm-uninstall';
  if (/removeLocalCache|cleanCloud/.test(endpoint)) return 'confirm-clear-cache';
  if (/\/exeCommand$/.test(endpoint)) return 'confirm-exec';
  if (/\/(enableRoot|openRoot|updateAdb|setKeyBox|setHideAccessibilityApp)$/.test(endpoint)) return 'confirm-security';
  if (/\/rpa\/.+\/(save|cancel)(\/[^/]+)?$/.test(endpoint)) return 'confirm-schedule';
  if (endpoint === '/api/webhook/config') return 'confirm-webhook';
  if (/\/setProxy(\/batch)?$/.test(endpoint)) return 'confirm-proxy';
  return undefined;
}

function boolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  throw new Error('Boolean value must be true or false');
}

function guard(endpoint, body, options = {}) {
  const flag = endpoint === '/api/cloudbrowser/stop' && boolean(body?.force, false)
    ? 'confirm-force-stop' : confirmationFlag(endpoint);
  if (flag && !boolean(options[flag], false)) {
    throw new Error(`${endpoint} requires --${flag} true after confirming the action and exact targets`);
  }
  if (flag) {
    const targets = Array.isArray(body) ? body : (body?.envIds || body?.ids || body?.id || body?.envId || body?.fileId || body?.phoneId || []);
    const ids = Array.isArray(targets) ? targets : [targets];
    console.error(JSON.stringify({ action: endpoint, confirmedBy: flag, targetCount: ids.length, targetIds: ids }));
  }
}

function timeoutFor(endpoint) {
  if (endpoint === '/api/env/core/download') return 1810000;
  if (endpoint === '/api/cloudphone/powerOn') return 120000;
  if (endpoint === '/api/env/start') return 30000;
  return 15000;
}

module.exports = { context, boolean, guard, confirmationFlag, timeoutFor };
