#!/usr/bin/env node

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'dist', 'index.js');
const packageVersion = require('../package.json').version;

function run(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.env.CLI_TEST_CWD || path.join(__dirname, '..'),
    encoding: 'utf-8',
  });
}

function assertSuccess(args, expectedText) {
  const result = run(args);
  assert.strictEqual(result.status, 0, `${args.join(' ')} should exit 0: ${result.stderr}`);
  assert(
    result.stdout.includes(expectedText),
    `${args.join(' ')} should print ${expectedText}, got: ${result.stdout}`
  );
  assert.strictEqual(result.stderr, '', `${args.join(' ')} should not write stderr`);
}

assertSuccess(['--help'], 'X Account Cleaner v');
assertSuccess(['followings', '--help'], 'X Account Cleaner following workflow');
assertSuccess(['--version'], packageVersion);

process.env.CLI_TEST_CWD = require('os').tmpdir();
assertSuccess(['--version'], packageVersion);
delete process.env.CLI_TEST_CWD;

const unknown = run(['unknown-command']);
assert.strictEqual(unknown.status, 1, 'unknown command should exit 1');
assert(unknown.stderr.includes('Unknown command: unknown-command'), unknown.stderr);
assert.strictEqual(unknown.stdout, '', 'unknown command should not print stdout');

console.log('✓ cli tests passed');
