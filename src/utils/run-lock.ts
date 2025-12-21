import * as fs from 'fs';
import * as path from 'path';
import { log } from './logger';

type LockInfo = {
  pid: number;
  runId: string;
  startedAt: string;
  lastHeartbeat: string;
  cwd: string;
  userDataDir: string;
};

export type RunLock = {
  lockPath: string;
  heartbeatInterval: NodeJS.Timeout;
  release: () => void;
};

const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TTL_MS = 15000;

function validateLockPath(userDataDir: string): string {
  const normalized = path.normalize(userDataDir);

  if (!normalized || normalized === '.' || normalized === path.sep) {
    throw new Error(`userDataDir 不能为空且不能指向根目录: ${userDataDir}`);
  }
  if (path.isAbsolute(normalized)) {
    throw new Error(`userDataDir 必须是相对路径: ${userDataDir}`);
  }
  const segments = normalized.split(path.sep).filter(Boolean);
  if (segments.includes('..')) {
    throw new Error(`userDataDir 不能包含 ..: ${userDataDir}`);
  }

  return path.join(process.cwd(), normalized);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ESRCH') {
      return false;
    }
    return true;
  }
}

function readLockInfo(lockPath: string): LockInfo | null {
  try {
    const content = fs.readFileSync(lockPath, 'utf-8');
    return JSON.parse(content) as LockInfo;
  } catch {
    return null;
  }
}

function parseTimeMs(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isHeartbeatExpired(info: LockInfo, nowMs: number): boolean {
  const heartbeatMs = parseTimeMs(info.lastHeartbeat) ?? parseTimeMs(info.startedAt);
  if (heartbeatMs === null) {
    return true;
  }
  return nowMs - heartbeatMs > HEARTBEAT_TTL_MS;
}

function safeUnlink(lockPath: string, context: string): void {
  try {
    fs.unlinkSync(lockPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return;
    }
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      log.warn(`${context}: 无权限删除锁文件: ${lockPath}`, error);
      return;
    }
    throw error;
  }
}

export function acquireRunLock(runId: string, userDataDir: string): RunLock {
  const lockDir = validateLockPath(userDataDir);
  fs.mkdirSync(lockDir, { recursive: true });

  const lockPath = path.join(lockDir, 'run.lock');
  const now = new Date().toISOString();
  const payload: LockInfo = {
    pid: process.pid,
    runId,
    startedAt: now,
    lastHeartbeat: now,
    cwd: process.cwd(),
    userDataDir,
  };

  try {
    fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2), { flag: 'wx' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      throw error;
    }

    const existing = readLockInfo(lockPath);
    if (!existing || typeof existing.pid !== 'number') {
      throw new Error(`检测到损坏的运行锁文件: ${lockPath}。请确认没有实例运行后删除该文件再试。`);
    }

    const nowMs = Date.now();
    const expired = isHeartbeatExpired(existing, nowMs);
    if (!expired && isProcessRunning(existing.pid)) {
      throw new Error(
        `检测到已有实例正在运行 (pid: ${existing.pid}, runId: ${existing.runId || 'unknown'})。` +
          '请先退出该实例或更换 USER_DATA_DIR。'
      );
    }

    if (expired) {
      log.warn(`检测到过期运行锁(心跳超时)，正在清理: ${lockPath}`);
    } else {
      log.warn(`检测到残留运行锁(进程不存在)，正在清理: ${lockPath}`);
    }

    safeUnlink(lockPath, '清理残留运行锁失败');
    fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2), { flag: 'wx' });
  }

  let warned = false;
  const heartbeatInterval = setInterval(() => {
    try {
      const existing = readLockInfo(lockPath);
      if (!existing) {
        return;
      }
      if (existing.pid !== process.pid || existing.runId !== runId) {
        return;
      }
      const next: LockInfo = { ...existing, lastHeartbeat: new Date().toISOString() };
      fs.writeFileSync(lockPath, JSON.stringify(next, null, 2));
      warned = false;
    } catch (error) {
      if (!warned) {
        warned = true;
        log.warn(`更新运行锁心跳失败: ${lockPath}`, error);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    lockPath,
    heartbeatInterval,
    release: () => {
      clearInterval(heartbeatInterval);
      try {
        const existing = readLockInfo(lockPath);
        if (existing && existing.pid === process.pid && existing.runId === runId) {
          safeUnlink(lockPath, '释放运行锁失败');
          return;
        }
      } catch (error) {
        log.warn(`释放运行锁失败: ${lockPath}`, error);
      }
    },
  };
}
