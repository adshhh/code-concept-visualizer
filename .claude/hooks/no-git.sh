#!/usr/bin/env bash
# Blocks any Bash command that invokes git or gh. See CLAUDE.md "Hard rules".
set -uo pipefail

# Emits a PreToolUse "deny" decision and stops the tool call. Defined before it
# is used, since bash resolves functions in execution order.
deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# Unparseable input means we cannot tell what is about to run, so refuse rather
# than wave it through.
if ! CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null); then
  deny "Blocked: .claude/hooks/no-git.sh could not parse the hook input, so it cannot confirm this command is not a git or gh invocation."
fi

# Matches git/gh only where they could plausibly be the program being run: at
# the very start of the command, or right after a separator (; & | ( ` or a
# space) -- and followed by whitespace, a separator, or the end of the
# command.
#
# Deliberately NOT "isolated by any non-letter" (that was the old bug): a
# hyphen or dot also isolates a word from grep -w's point of view, which is
# why the previous version blocked harmless things like `cat no-git.sh` or
# `docs/git-notes.md` -- "git" in a filename is flanked by "-" and "." there,
# not by a real command boundary.
#
# Known, accepted gaps (this is text matching, not a shell parser, and it
# assumes Claude is cooperating with the rule rather than trying to dodge
# it): a full path like /usr/bin/git is not caught -- an earlier version
# matched a leading "/" to catch this, but that also matched ordinary text
# like "git/gh" in a comment, which is a worse trade. Also not caught:
# splitting the literal string with empty quotes (gi''t status). Both are
# out of scope for a guardrail whose job is to catch normal usage, not
# deliberate evasion.
if printf '%s' "$CMD" | grep -Eq '(^|[[:space:];&|(`])(git|gh)([[:space:];&|)]|$)'; then
  deny "Blocked by .claude/hooks/no-git.sh: this project's owner performs every git and GitHub operation personally (CLAUDE.md, Hard rules). This is absolute and has no exceptions, including read-only commands. Do not retry with different phrasing, a wrapper, or a script — tell the owner the exact command you wanted to run and let them run it."
fi

exit 0   # allow