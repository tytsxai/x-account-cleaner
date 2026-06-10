#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig } = require('../dist/config/config');

function withTempCwd(fn) {
  const previousCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-config-test-'));

  process.chdir(tmpDir);
  try {
    fn(tmpDir);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function testMissingConfigHasActionableMessage() {
  withTempCwd(() => {
    assert.throws(
      () => loadConfig(),
      /配置文件 config\.json 不存在.*cp node_modules\/x-account-cleaner\/config\.json/s
    );
  });
}

function testMalformedConfigHasActionableMessage() {
  withTempCwd(() => {
    fs.writeFileSync('config.json', '{ invalid json', 'utf-8');

    assert.throws(
      () => loadConfig(),
      /config\.json 解析失败.*请修复 JSON 格式后再运行/s
    );
  });
}

testMissingConfigHasActionableMessage();
testMalformedConfigHasActionableMessage();

console.log('✓ config tests passed');
