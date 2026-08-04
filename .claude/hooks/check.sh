#!/usr/bin/env bash
# Runs automatically after Claude edits or writes a file (see .claude/settings.json).
# Formats it, type-checks the project, and runs tests — and BLOCKS (exit 2) if any
# of that fails, so Claude sees the failure and must fix it before moving on.
#
# Safe to run before the project is scaffolded: if package.json or a given npm
# script doesn't exist yet, that check is skipped rather than treated as a failure.

set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only source files trigger checks — skip docs, JSON, etc.
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Nothing to check until the project has been scaffolded.
if [ ! -f package.json ]; then
  exit 0
fi

FAILURES=""

run_script_if_present() {
  local script_name="$1"
  if jq -e --arg s "$script_name" '.scripts[$s]' package.json >/dev/null 2>&1; then
    if ! npm run --silent "$script_name" 2>&1; then
      FAILURES="${FAILURES}
- npm run $script_name failed"
    fi
  fi
}

run_script_if_present "format"
run_script_if_present "typecheck"
run_script_if_present "test"

if [ -n "$FAILURES" ]; then
  echo "Post-edit checks failed on $FILE:$FAILURES" >&2
  exit 2
fi

exit 0
