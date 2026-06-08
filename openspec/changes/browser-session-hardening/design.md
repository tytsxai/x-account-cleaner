# Design

## Session Storage Model

`USER_DATA_DIR` remains the per-account root directory. Files directly under that root are project-managed control artifacts such as `run.lock` and `state.json`.

The browser's persistent profile lives under:

```text
USER_DATA_DIR/profile/
```

The split keeps project control files separate from the browser's own profile tree and makes reset operations less ambiguous:

- `profile/` is the primary live browser session. It preserves cookies, local storage, IndexedDB, service workers, and browser profile metadata across runs.
- `state.json` is a secondary Playwright storage-state snapshot written by `saveState()`. It is useful for audit, migration, and recovery, but is not the source of truth for an already established persistent context.

## Failure Handling

Browser startup is treated as a transaction:

- Ensure `USER_DATA_DIR` and `profile/` exist.
- Launch a persistent context.
- Create or reuse a page.
- Apply timeouts and initialization scripts.

If any startup step fails after creating resources, close the page/context. If the profile directory was created by the failed attempt and was empty before the attempt, remove it. Existing profile directories are never deleted automatically.

`saveState()` writes to `state.json.tmp` first and renames it into place. If writing, chmod, or rename fails, the temporary file is removed and the previous `state.json` is left untouched.
