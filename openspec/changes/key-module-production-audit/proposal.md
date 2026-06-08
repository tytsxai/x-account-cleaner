# Key Module Production Audit

## Why

The project is close to a usable CLI release, but key production paths still need a focused reliability audit. The priority is not broad redesign; it is preventing real runs from silently continuing after unsafe states, making installed-package failures actionable, and keeping release checks maintainable.

## What Changes

- Preserve cancellation and blocking errors through deletion batch handling instead of swallowing them as ordinary batch failures.
- Make missing `config.json` errors actionable for npm-installed users.
- Prevent the default cleanup entry from starting when no `deleteOptions` are enabled; users should use `followings` subcommands for the following-management workflow.
- Keep CLI version tests tied to `package.json` instead of hard-coding the release version.
- Update operations/readiness docs to capture these production guardrails.

## Impact

- Rate-limit, restricted-account, and cancellation states stop the run instead of being masked by batch-level error handling.
- Installed users get a direct recovery command when they run from an empty directory.
- Future patch releases can update `package.json.version` without breaking CLI smoke tests.
