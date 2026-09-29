// Independent release expectations, deliberately not imported from production policy.
module.exports = Object.fromEntries(Object.entries({
  'confirm-delete': ['/api/env/removeToRecycleBin/batch', '/api/cloudphone/delete/batch', '/api/proxyInfo/delete', '/api/envgroup/delete', '/api/envtag/delete', '/api/cloudstorage/file/delete/batch', '/api/cloudstorage/tag/delete/batch'],
  'confirm-clear-cache': ['/api/env/removeLocalCache', '/api/env/cache/cleanCloud'],
  'confirm-proxy': ['/api/env/setProxy/batch', '/api/cloudphone/setProxy'],
  'confirm-close-all': ['/api/env/closeAll'],
  'confirm-charge': ['/api/cloudphone/monthly/activate'],
  'confirm-security': ['/api/cloudphone/setKeyBox', '/api/cloudphone/app/openRoot', '/api/cloudphone/app/setHideAccessibilityApp', '/api/cloudphone/enableRoot', '/api/cloudphone/updateAdb'],
  'confirm-uninstall': ['/api/cloudphone/app/uninstall'],
  'confirm-reset': ['/api/cloudphone/reset', '/api/cloudphone/newMachine'],
  'confirm-power-off': ['/api/cloudphone/powerOff'],
  'confirm-exec': ['/api/cloudphone/exeCommand'],
  'confirm-schedule': ['/api/cloudphone/rpa/task/save', '/api/cloudphone/rpa/onceTask/save', '/api/cloudphone/rpa/task/cancel', '/api/cloudphone/rpa/subTask/cancel/{id}'],
  'confirm-webhook': ['/api/webhook/config'],
}).flatMap(([flag, endpoints]) => endpoints.map((route) => [route, flag])));
