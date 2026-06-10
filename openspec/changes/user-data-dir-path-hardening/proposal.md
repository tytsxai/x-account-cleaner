# User Data Dir Path Hardening

## Why

Production runs often pin each account to an absolute `USER_DATA_DIR`, especially under cron, launch agents, containers, or shared operator workspaces. `BrowserManager` already resolves `USER_DATA_DIR` as a filesystem path, but the run-lock layer rejected absolute paths. That made a valid deployment configuration fail before startup and created inconsistent guidance between runtime modules.

The path resolver still needs guardrails: a lock file should never be written to the filesystem root or the project root by accident, and relative paths that escape the working directory should remain rejected.

## What Changes

- Resolve `USER_DATA_DIR` consistently for browser state and `run.lock`.
- Allow absolute account data directories.
- Continue rejecting empty values, the current project root, the filesystem root, and relative paths containing `..`.
- Add local tests for relative paths, absolute paths, concurrent lock rejection, and dangerous path rejection.
- Document the supported path forms in operations/readiness docs.

## Impact

- Existing relative paths such as `./browser-data` keep working.
- Production users can use absolute per-account paths without disabling the run lock.
- Unsafe path values fail early with explicit messages.
