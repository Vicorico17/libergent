# GitHub Pull/Push Workflow

This repository uses a branch + pull request workflow. Do not push directly to `main`.

## 1. Verify source of truth and sync main

```bash
git fetch origin
git remote -v
git checkout main
git pull --ff-only origin main
```

Expected remote:

- `origin https://github.com/Vicorico17/libergent.git (fetch)`
- `origin https://github.com/Vicorico17/libergent.git (push)`

If `origin` is different, fix it before doing any work:

```bash
git remote set-url origin https://github.com/Vicorico17/libergent.git
git fetch origin --prune
```

## 2. Create an issue branch

```bash
git checkout -b feat/<short-topic>
```

Branch naming:

- `feat/<topic>` for new behavior
- `fix/<topic>` for bug fixes
- `chore/<topic>` for maintenance
- `docs/<topic>` for documentation only

## 3. Implement and verify

Run the smallest checks that prove your change before pushing.

```bash
npm install
npm run test
```

If your change only touches docs, skip runtime checks and explain that in the pull request.

## 4. Commit

Use small, reviewable commits.

```bash
git add <files>
git commit -m "feat: add <what changed>"
```

Conventional commit prefixes used in this repo:

- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`
- `test:`

## 5. Push branch with project helper

```bash
scripts/paperclip-git-push.sh <branch-name>
```

Notes:

- If `<branch-name>` is omitted, the helper uses the current branch.
- The helper requires `GITHUB_PAT_TOKEN` (or `/docker/paperclip-aiym/.env` containing it).
- If pushing fails with auth/permission errors, mark the issue `blocked` and name the owner who must grant token/repo access.

## 6. Open pull request

Create a PR against `main` and include:

- problem statement
- technical approach
- verification steps and results
- risks/rollback notes

## 7. Review and merge

- Address review feedback with follow-up commits.
- Keep history linear where possible (`git pull --ff-only`).
- Merge only after required checks pass.

## 8. Sync after merge

```bash
git checkout main
git pull --ff-only origin main
git branch -d feat/<short-topic>
```

## Emergency exception

Direct pushes to `main` require explicit CEO approval in the issue thread and a follow-up retrospective comment describing why normal PR flow was bypassed.
