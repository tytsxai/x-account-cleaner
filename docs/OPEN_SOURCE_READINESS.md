# Open Source Readiness

This checklist defines the public repository surface that helps new users decide whether X Account Cleaner is safe enough to try and clear enough to star or contribute to.

## Public Trust Surface

| Area | Current status | File |
|---|---|---|
| Main project pitch, features, limits, Star History | Ready | [../README.md](../README.md) |
| Five-minute setup path | Ready | [../QUICKSTART.md](../QUICKSTART.md) |
| Documentation index | Ready | [README.md](README.md) |
| Following cleanup safety workflow | Ready | [FOLLOWING_MANAGEMENT.md](FOLLOWING_MANAGEMENT.md) |
| Troubleshooting and selector repair | Ready | [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [SELECTOR_UPDATE_GUIDE.md](SELECTOR_UPDATE_GUIDE.md) |
| CI verification | Ready | [../.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| Bug and feature intake | Ready | [../.github/ISSUE_TEMPLATE](../.github/ISSUE_TEMPLATE) |
| Pull request checklist | Ready | [../.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) |
| Security policy | Ready | [../SECURITY.md](../SECURITY.md) |
| npm package contents check | Ready | `npm pack --dry-run` |

## Maintainer Release Gate

Before publishing a release or asking users to try a new workflow:

```bash
npm ci
npm run verify
npm pack --dry-run
```

For behavior that touches real X / Twitter pages, also run a headful manual smoke test with a low `maxDeletePerSession` and confirm the generated `logs/run-summary-*.json` contains the expected command, config, selector source, and status.

## Repository Topics

Recommended GitHub topics:

`x`, `twitter`, `twitter-cleaner`, `x-account-cleaner`, `account-cleaner`, `bulk-delete-tweets`, `bulk-unlike`, `bulk-unfollow`, `playwright`, `typescript`, `automation`, `privacy-tool`, `local-first`

## Star-Friendly Positioning

The project should consistently emphasize:

- Local-first: no server and no official X API key required.
- Safety-first destructive operations: small batches, review files, dry-run, explicit confirmation, run summaries.
- Maintainer-friendly selector updates: selector config is separate from core code.
- Practical scope: account cleanup and review workflows, not risk-control bypassing or recovery of deleted data.
