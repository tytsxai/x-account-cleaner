#!/usr/bin/env node

require('ts-node/register');

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  FollowingClassifier,
  FollowingExecutor,
  classifyFollowings,
  normalizeHandle,
} = require('../src/core/following-management');

function makeAccount(handle, overrides = {}) {
  return {
    handle,
    displayName: overrides.displayName || null,
    bio: overrides.bio || null,
    isVerified: Boolean(overrides.isVerified),
    followsYou: Boolean(overrides.followsYou),
    avatarUrl: null,
    profileUrl: `https://x.com/${normalizeHandle(handle)}`,
    collectedAt: '2026-05-21T00:00:00.000Z',
  };
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf-8');
}

function makeFollowingConfig(tmpDir, overrides = {}) {
  return {
    followingManagement: {
      enabled: true,
      outputDir: tmpDir,
      defaultMode: 'export',
      rules: {
        keepHandles: [],
        dropHandles: [],
        keepKeywords: [],
        dropKeywords: [],
        lowInfoCandidate: true,
      },
      execution: {
        minDelayMs: 0,
        maxDelayMs: 0,
        maxUnfollowPerSession: 10,
        requireConfirmFile: true,
        maxConsecutiveFailures: 3,
        cooldownEveryActions: 20,
        cooldownMs: 300000,
        ...(overrides.execution || {}),
      },
      safety: {
        requireHeadfulForExecute: true,
        stopOnRiskSignals: true,
        riskTextPatterns: ['account locked'],
        ...(overrides.safety || {}),
      },
    },
    selectors: {},
    urls: {
      following: 'https://x.com/{username}/following',
    },
  };
}

function testClassifierRules() {
  const rules = {
    keepHandles: ['trusted_ai'],
    dropHandles: ['spam_bot'],
    keepKeywords: ['openai'],
    dropKeywords: ['airdrop'],
    lowInfoCandidate: true,
  };
  const classified = classifyFollowings(
    [
      makeAccount('@trusted_ai', { bio: 'airdrop everywhere' }),
      makeAccount('@spam_bot', { bio: 'normal profile' }),
      makeAccount('@builder', { bio: 'OpenAI and developer notes' }),
      makeAccount('@empty'),
      makeAccount('@empty'),
    ],
    rules
  );

  assert.strictEqual(classified.length, 4, 'dedupes duplicate handles');
  assert.strictEqual(classified.find((item) => item.handle === '@trusted_ai').decision, 'keep');
  assert.strictEqual(classified.find((item) => item.handle === '@spam_bot').decision, 'candidate');
  assert.strictEqual(classified.find((item) => item.handle === '@builder').decision, 'keep');
  assert.strictEqual(classified.find((item) => item.handle === '@empty').decision, 'candidate');
}

function testDryRunSession() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-test-'));
  const inputFile = path.join(tmpDir, 'approved-unfollow.jsonl');
  writeJsonl(inputFile, [
    makeAccount('@drop_one', { displayName: 'Drop One' }),
    makeAccount('@drop_two', { displayName: 'Drop Two' }),
    makeAccount('@drop_one', { displayName: 'Duplicate' }),
  ]);

  const config = makeFollowingConfig(tmpDir);

  const session = new FollowingExecutor({}, config, 'dry-run').dryRun(inputFile);
  assert.strictEqual(session.items.length, 2, 'dry-run dedupes input handles');
  assert.strictEqual(session.processed, 2, 'dry-run marks all items processed');
  assert.strictEqual(session.skipped, 2, 'dry-run never performs destructive actions');
  assert(session.items.every((item) => item.status === 'skipped'), 'all dry-run items are skipped');
}

function testClassifierCreatesEmptyApprovalTemplate() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-classify-'));
  const inputFile = path.join(tmpDir, 'followings.jsonl');
  writeJsonl(inputFile, [
    makeAccount('@drop_one'),
    makeAccount('@keep_one', { bio: 'ordinary profile', isVerified: true }),
  ]);

  const result = new FollowingClassifier(makeFollowingConfig(tmpDir)).classify(inputFile);
  const approvedContent = fs.readFileSync(result.approvedTemplatePath, 'utf-8');
  const candidatesContent = fs.readFileSync(result.candidatesPath, 'utf-8');

  assert.strictEqual(approvedContent, '', 'approval template starts empty');
  assert(candidatesContent.includes('@drop_one'), 'candidates are still written for review');
}

function testClassifierDoesNotOverwriteExistingApprovalFile() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-classify-keep-'));
  const inputFile = path.join(tmpDir, 'followings.jsonl');
  const approvedFile = path.join(tmpDir, 'approved-unfollow.jsonl');
  writeJsonl(inputFile, [makeAccount('@drop_one')]);
  fs.writeFileSync(approvedFile, `${JSON.stringify(makeAccount('@manual_keep'))}\n`, 'utf-8');

  new FollowingClassifier(makeFollowingConfig(tmpDir)).classify(inputFile);
  const approvedContent = fs.readFileSync(approvedFile, 'utf-8');

  assert(approvedContent.includes('@manual_keep'), 'classify must not overwrite manual approvals');
}

async function testAutoGeneratedConfirmFilesRejected() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-confirm-'));
  const config = makeFollowingConfig(tmpDir, {
    safety: { requireHeadfulForExecute: false },
  });

  const candidatesFile = path.join(tmpDir, 'candidates.jsonl');
  writeJsonl(candidatesFile, [makeAccount('@drop_one')]);

  await assert.rejects(
    () => new FollowingExecutor({}, config, 'confirm-test').execute(candidatesFile),
    /拒绝直接执行自动生成文件 candidates\.jsonl/
  );
}

async function testEmptyApprovalFileRejected() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-empty-'));
  const inputFile = path.join(tmpDir, 'approved-unfollow.jsonl');
  fs.writeFileSync(inputFile, '', 'utf-8');

  const config = makeFollowingConfig(tmpDir, {
    safety: { requireHeadfulForExecute: false },
  });

  await assert.rejects(
    () => new FollowingExecutor({}, config, 'empty-test').execute(inputFile),
    /确认名单为空/
  );
}

async function testHeadlessExecuteBlocked() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-headless-'));
  const inputFile = path.join(tmpDir, 'approved-unfollow.jsonl');
  writeJsonl(inputFile, [makeAccount('@drop_one')]);

  const config = makeFollowingConfig(tmpDir);

  const previous = process.env.HEADLESS;
  process.env.HEADLESS = 'true';
  try {
    await assert.rejects(
      () => new FollowingExecutor({}, config, 'headless-test').execute(inputFile),
      /HEADLESS=false/
    );
  } finally {
    if (previous === undefined) {
      delete process.env.HEADLESS;
    } else {
      process.env.HEADLESS = previous;
    }
  }
}

function makeFakePage() {
  return {
    async goto() {},
    url() {
      return 'https://x.com/current_user/following';
    },
    locator() {
      return {
        async innerText() {
          return '';
        },
      };
    },
  };
}

async function testExecuteSessionBindsUsername() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-session-user-'));
  const inputFile = path.join(tmpDir, 'approved-unfollow.jsonl');
  writeJsonl(inputFile, [makeAccount('@already_gone')]);

  const config = makeFollowingConfig(tmpDir, {
    safety: { requireHeadfulForExecute: false },
    execution: { maxConsecutiveFailures: 1 },
  });
  const executor = new FollowingExecutor(makeFakePage(), config, 'current_user');
  executor.unfollowByHandle = async () => {
    return { ok: false, reason: 'handle-not-found' };
  };

  await executor.execute(inputFile, 'bound-run');
  const session = JSON.parse(fs.readFileSync(path.join(tmpDir, 'bound-run', 'session.json')));

  assert.strictEqual(session.username, '@current_user', 'execute stores current username');
}

async function testResumeRejectsMismatchedUsername() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-session-mismatch-'));
  const runDir = path.join(tmpDir, 'mismatch-run');
  fs.mkdirSync(runDir, { recursive: true });
  const inputFile = path.join(runDir, 'approved-unfollow.jsonl');
  writeJsonl(inputFile, [makeAccount('@drop_one')]);
  fs.writeFileSync(
    path.join(runDir, 'session.json'),
    JSON.stringify(
      {
        runId: 'mismatch-run',
        mode: 'execute',
        inputFile,
        username: '@other_user',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'running',
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        maxUnfollowPerSession: 10,
        items: [{ handle: '@drop_one', displayName: null, status: 'pending' }],
      },
      null,
      2
    )
  );

  const config = makeFollowingConfig(tmpDir, {
    safety: { requireHeadfulForExecute: false },
  });

  await assert.rejects(
    () => new FollowingExecutor(makeFakePage(), config, 'current_user').resume('mismatch-run'),
    /session 账号与当前登录账号不一致/
  );
}

async function testResumeSkipsFailedItems() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-following-session-failed-'));
  const runDir = path.join(tmpDir, 'failed-run');
  fs.mkdirSync(runDir, { recursive: true });
  const inputFile = path.join(runDir, 'approved-unfollow.jsonl');
  writeJsonl(inputFile, [makeAccount('@bad_one')]);
  fs.writeFileSync(
    path.join(runDir, 'session.json'),
    JSON.stringify(
      {
        runId: 'failed-run',
        mode: 'execute',
        inputFile,
        username: '@current_user',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'running',
        processed: 1,
        success: 0,
        failed: 1,
        skipped: 0,
        maxUnfollowPerSession: 10,
        items: [
          {
            handle: '@bad_one',
            displayName: null,
            status: 'failed',
            reason: 'handle-not-found',
          },
        ],
      },
      null,
      2
    )
  );

  const config = makeFollowingConfig(tmpDir, {
    safety: { requireHeadfulForExecute: false },
  });
  const executor = new FollowingExecutor(makeFakePage(), config, 'current_user');
  let retriedFailed = false;
  executor.unfollowByHandle = async () => {
    retriedFailed = true;
    return { ok: false, reason: 'should-not-run' };
  };

  await executor.resume('failed-run');
  const session = JSON.parse(fs.readFileSync(path.join(runDir, 'session.json')));

  assert.strictEqual(retriedFailed, false, 'resume does not retry failed items by default');
  assert.strictEqual(session.status, 'failed', 'failed-only sessions are not left running');
}

async function main() {
  testClassifierRules();
  testDryRunSession();
  testClassifierCreatesEmptyApprovalTemplate();
  testClassifierDoesNotOverwriteExistingApprovalFile();
  await testAutoGeneratedConfirmFilesRejected();
  await testEmptyApprovalFileRejected();
  await testHeadlessExecuteBlocked();
  await testExecuteSessionBindsUsername();
  await testResumeRejectsMismatchedUsername();
  await testResumeSkipsFailedItems();

  console.log('✓ following management tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
