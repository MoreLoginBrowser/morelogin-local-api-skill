#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const { requestApi, unwrapApiResult } = require('../bin/common');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'morelogin.js');

function runCli(args) {
  const res = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  return {
    ok: res.status === 0,
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function logStep(name, result, required = true) {
  const status = result.ok ? 'PASS' : (required ? 'FAIL' : 'SKIP/FAIL');
  console.log(`${status} ${name}`);
  if (!result.ok) {
    const output = `${result.stdout}\n${result.stderr}`.trim().slice(0, 400);
    console.log(`  exit=${result.code}`);
    if (output) console.log(`  output=${output}`);
  }
  return result.ok || !required;
}

async function getFirstEnvId() {
  try {
    const response = await requestApi('/api/env/page', { method: 'POST', body: { pageNo: 1, pageSize: 1 } });
    const result = unwrapApiResult(response);
    if (!result.success) return null;
    return result.data?.dataList?.[0]?.id || null;
  } catch (error) {
    return null;
  }
}

async function getFirstCloudphoneId() {
  try {
    const response = await requestApi('/api/cloudphone/page', { method: 'POST', body: { pageNo: 1, pageSize: 1 } });
    const result = unwrapApiResult(response);
    if (!result.success) return null;
    return result.data?.dataList?.[0]?.id || null;
  } catch (error) {
    return null;
  }
}

async function findGroupIdByName(groupName) {
  try {
    const response = await requestApi('/api/envgroup/page', {
      method: 'POST',
      body: { groupName, pageNo: 1, pageSize: 20 },
    });
    const result = unwrapApiResult(response);
    if (!result.success) return null;
    const item = (result.data?.dataList || []).find((g) => String(g.groupName || '') === groupName);
    return item?.id || null;
  } catch (error) {
    return null;
  }
}

async function findTagIdByName(tagName) {
  try {
    const response = await requestApi('/api/envtag/all', { method: 'GET' });
    const result = unwrapApiResult(response);
    if (!result.success) return null;
    const item = (result.data || []).find((t) => String(t.tagName || '') === tagName);
    return item?.id || null;
  } catch (error) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const checks = [];
  console.log('Running real E2E against local MoreLogin API...\n');

  checks.push(logStep('browser list', runCli(['browser', 'list', '--page', '1', '--page-size', '5'])));
  checks.push(logStep('proxy list', runCli(['proxy', 'list', '--page', '1', '--page-size', '5'])));
  checks.push(logStep('group list', runCli(['group', 'list', '--page', '1', '--page-size', '10'])));
  checks.push(logStep('tag list', runCli(['tag', 'list'])));
  checks.push(logStep('api passthrough env page', runCli(['api', '--endpoint', '/api/env/page', '--method', 'POST', '--data', '{"pageNo":1,"pageSize":3}'])));

  const envId = await getFirstEnvId();
  if (envId) {
    checks.push(logStep(`browser detail (${envId})`, runCli(['browser', 'detail', '--env-id', String(envId)])));
    const startResult = runCli(['browser', 'start', '--env-id', String(envId)]);
    checks.push(logStep(`browser start (${envId})`, startResult, false));
    if (!startResult.ok) {
      await sleep(1500);
    }
    checks.push(logStep(`browser status (${envId})`, runCli(['browser', 'status', '--env-id', String(envId)])));
    checks.push(logStep(`browser close (${envId})`, runCli(['browser', 'close', '--env-id', String(envId)]), false));
  } else {
    console.log('SKIP browser detail/start/status/close (no profile found)');
  }

  const cloudId = await getFirstCloudphoneId();
  if (cloudId) {
    checks.push(logStep(`cloudphone list`, runCli(['cloudphone', 'list', '--page', '1', '--page-size', '5'])));
    checks.push(logStep(`cloudphone info (${cloudId})`, runCli(['cloudphone', 'info', '--id', String(cloudId)])));
    checks.push(logStep(`cloudphone adb-info (${cloudId})`, runCli(['cloudphone', 'adb-info', '--id', String(cloudId)])));
    checks.push(logStep(`cloudphone app-installed (${cloudId})`, runCli(['cloudphone', 'app-installed', '--id', String(cloudId)]), false));
  } else {
    console.log('SKIP cloudphone info/adb-info/app-installed (no cloud phone found)');
  }

  // Reversible write-path checks: create -> edit -> delete
  const suffix = Date.now();
  const groupName = `e2e-group-${suffix}`;
  const groupNameEdited = `${groupName}-edited`;
  checks.push(logStep('group create temp', runCli(['group', 'create', '--name', groupName])));
  const groupId = await findGroupIdByName(groupName);
  if (groupId) {
    checks.push(logStep('group edit temp', runCli(['group', 'edit', '--id', String(groupId), '--name', groupNameEdited])));
    checks.push(logStep('group delete temp', runCli(['group', 'delete', '--ids', String(groupId)])));
  } else {
    console.log('FAIL group create temp (id not found after create)');
    checks.push(false);
  }

  const tagName = `e2e-tag-${suffix}`;
  const tagNameEdited = `${tagName}-edited`;
  checks.push(logStep('tag create temp', runCli(['tag', 'create', '--name', tagName])));
  const tagId = await findTagIdByName(tagName);
  if (tagId) {
    checks.push(logStep('tag edit temp', runCli(['tag', 'edit', '--id', String(tagId), '--name', tagNameEdited])));
    checks.push(logStep('tag delete temp', runCli(['tag', 'delete', '--ids', String(tagId)])));
  } else {
    console.log('FAIL tag create temp (id not found after create)');
    checks.push(false);
  }

  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  console.log(`\nE2E summary: ${passed}/${total} steps passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error(`E2E crashed: ${error.message}`);
  process.exit(1);
});
