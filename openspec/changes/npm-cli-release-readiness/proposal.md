# npm CLI Release Readiness

## Why

The project already has a `bin` entry, but the public release surface was inconsistent: npm install and `npx` usage were not documented, the changelog mixed `0.1.0`, `1.0.0`, and `1.2.0` with conflicting dates, and the open-source checklist did not define the package release gate clearly.

## What Changes

- Treat `1.0.0` as the next public npm / CLI-ready release.
- Keep `0.1.0` as the earlier source-usable baseline.
- Update package metadata for npm publication: author, `LICENSE` in files, public publish config, and `release:check`.
- Document `npx x-account-cleaner`, global install, and source checkout workflows.
- Make the current-working-directory requirement for `config.json`, `selectors.json`, and optional `.env` explicit.
- Align `README.md`, `QUICKSTART.md`, `CHANGELOG.md`, `docs/OPEN_SOURCE_READINESS.md`, and release/contribution guidance.
- Update CLI help so installed users see `npx` and config-directory expectations.

## Impact

- Users can install the package and understand how to create a runnable workspace.
- Maintainers have one command for the local release gate.
- Public docs no longer imply already-published or impossible versions.
