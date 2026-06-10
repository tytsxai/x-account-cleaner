#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { acquireRunLock } = require('../dist/utils/run-lock');

function withTempCwd(fn) {
  const previousCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-run-lock-'));

  process.chdir(tmpDir);
  try {
    return fn(tmpDir);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function release(lock) {
  if (lock) {
    lock.release();
  }
}

function testRelativeUserDataDirLock() {
  withTempCwd(() => {
    const lock = acquireRunLock('relative-run', './browser-data');
    try {
      assert.strictEqual(lock.lockPath, path.join(process.cwd(), 'browser-data', 'run.lock'));
      assert(fs.existsSync(lock.lockPath), 'relative lock file should exist');
    } finally {
      release(lock);
    }
    assert(!fs.existsSync(lock.lockPath), 'relative lock file should be released');
  });
}

function testAbsoluteUserDataDirLock() {
  withTempCwd(() => {
    const absoluteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-run-lock-absolute-'));
    const lock = acquireRunLock('absolute-run', absoluteDir);
    try {
      assert.strictEqual(lock.lockPath, path.join(absoluteDir, 'run.lock'));
      assert(fs.existsSync(lock.lockPath), 'absolute lock file should exist');
    } finally {
      release(lock);
      fs.rmSync(absoluteDir, { recursive: true, force: true });
    }
  });
}

function testConcurrentLockRejected() {
  withTempCwd(() => {
    const lock = acquireRunLock('first-run', './browser-data');
    try {
      assert.throws(
        () => acquireRunLock('second-run', './browser-data'),
        /检测到已有实例正在运行/
      );
    } finally {
      release(lock);
    }
  });
}

function testDangerousPathsRejected() {
  withTempCwd(() => {
    assert.throws(() => acquireRunLock('empty-run', ''), /不能为空/);
    assert.throws(() => acquireRunLock('cwd-run', '.'), /当前目录/);
    assert.throws(() => acquireRunLock('parent-run', '../browser-data'), /不能包含 \.\./);
    assert.throws(() => acquireRunLock('nested-parent-run', 'profiles/../account-a'), /不能包含 \.\./);
    assert.throws(() => acquireRunLock('root-run', path.parse(process.cwd()).root), /根目录/);
  });
}

testRelativeUserDataDirLock();
testAbsoluteUserDataDirLock();
testConcurrentLockRejected();
testDangerousPathsRejected();

console.log('✓ run lock tests passed');
