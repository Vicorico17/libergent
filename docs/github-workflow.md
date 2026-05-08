# GitHub Pull/Push Workflow

This repository uses a branch + pull request workflow. Do not push directly to `main`.

## 1. Prepare local branch

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/<short-topic>
```

Branch naming:

- `feat/<topic>` for new behavior
- `fix/<topic>` for bug fixes
- `chore/<topic>` for maintenance
- `docs/<topic>` for documentation only

## 2. Implement and verify

Run the smallest checks that prove your change before pushing.

```bash
npm install
npm run test
```

If your change only touches docs, skip runtime checks and explain that in the pull request.

## 3. Commit

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

## 4. Push branch

```bash
git push -u origin feat/<short-topic>
```

## 5. Open pull request

Create a PR against `main` and include:

- problem statement
- technical approach
- verification steps and results
- risks/rollback notes

## 6. Review and merge

- Address review feedback with follow-up commits.
- Keep history linear where possible (`git pull --ff-only`).
- Merge only after required checks pass.

## 7. Sync after merge

```bash
git checkout main
git pull --ff-only origin main
git branch -d feat/<short-topic>
```

## Emergency exception

Direct pushes to `main` require explicit CEO approval in the issue thread and a follow-up retrospective comment describing why normal PR flow was bypassed.
