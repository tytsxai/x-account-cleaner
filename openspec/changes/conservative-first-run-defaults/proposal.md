# Conservative First-Run Defaults

## Why

New users see multiple entry points before they understand that cleanup actions are irreversible and that `maxDeletePerSession` applies per enabled content type. The repository already has a safer following-management workflow, but the default content cleanup cap and onboarding docs still contain older, less conservative guidance.

## What Changes

- Set the shipped first-run content cleanup cap to `maxDeletePerSession: 5`.
- Keep `deletePerBatch` no larger than the first-run cap.
- Keep legacy direct following deletion disabled by default and document `followings export` as the safe first step.
- Align `README.md`, `START_HERE.md`, `QUICKSTART.md`, and relevant `docs/` pages around the same conservative first-run baseline.

## Impact

- First runs are slower but lower risk.
- Users who need larger cleanup jobs can still raise limits after a visible, headful smoke run.
- Following cleanup remains confirmation-file based and cannot be triggered from old onboarding guidance.
