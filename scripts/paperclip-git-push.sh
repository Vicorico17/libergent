#!/usr/bin/env bash
set -euo pipefail

branch="${1:-}"
if [[ -z "$branch" ]]; then
  branch="$(git branch --show-current)"
fi

if [[ -z "$branch" ]]; then
  echo "No branch name supplied and current branch could not be detected." >&2
  exit 2
fi

for token_file in /paperclip/.github-token /docker/paperclip-aiym/.github-token; do
  if [[ -r "$token_file" ]]; then
    GITHUB_PAT_TOKEN="$(tr -d "\r\n" < "$token_file")"
    break
  fi
done

if [[ -z "${GITHUB_PAT_TOKEN:-}" ]]; then
  if [[ -r /docker/paperclip-aiym/.env ]]; then
    GITHUB_PAT_TOKEN="$(sed -n "s/^GITHUB_PAT_TOKEN=//p" /docker/paperclip-aiym/.env)"
  fi
fi

if [[ -z "${GITHUB_PAT_TOKEN:-}" ]]; then
  echo "GITHUB_PAT_TOKEN is not available; cannot push to GitHub." >&2
  exit 2
fi
export GITHUB_PAT_TOKEN

askpass="$(mktemp)"
trap "rm -f \"$askpass\"" EXIT
cat > "$askpass" <<"ASKPASS"
#!/bin/sh
case "$1" in
  *Username*) printf "%s\n" "x-access-token" ;;
  *Password*) printf "%s\n" "$GITHUB_PAT_TOKEN" ;;
  *) printf "\n" ;;
esac
ASKPASS
chmod 700 "$askpass"

GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$askpass" git push -u origin "$branch"
