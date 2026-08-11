# Failure modes for git-push-pat

## Error: credential prompt timed out
- **Symptom:** `assistant credentials prompt ...` returns "Error: The credential prompt timed out"
- **Root cause:** The `bash` tool's `timeout_seconds` was too short (default 120s, user needs ~330s to notice and respond to the prompt)
- **Fix:** Retry with `timeout_seconds: 330` on the bash tool call

## Error: remote not found
- **Symptom:** `fatal: repository '...' not found`
- **Root cause:** Wrong owner/repo in the URL. The user may pass an SSH-style URL (`git@github.com:owner/repo.git`) but the push URL uses HTTPS with token auth
- **Fix:** The `owner/repo` portion is the same in both formats. Convert: `git@github.com:ahumuzad077-design/friday.git` → `https://x-access-token:TOKEN@github.com/ahumuzad077-design/friday.git`

## Error: 403 forbidden on push
- **Symptom:** `remote: Permission denied` / HTTP 403
- **Root cause:** Token lacks required scope. Need at minimum `repo` (classic) or `contents:write` (fine-grained)
- **Fix:** Prompt the user for a new token with the right scopes

## Error: nothing to commit
- **Symptom:** `git status` shows files but `git add <path>` reports "nothing to commit, working tree clean"
- **Root cause:** The heartbeat safety net auto-commits file changes on a timer. The files are already in the git tree.
- **Fix:** Just add the remote and push — the commit already exists in history.

## Observed behavior: plugin files auto-committed
- When files land under `/workspace/plugins/`, the workspace heartbeat safety net (`auto-commit: heartbeat safety net`) may commit them before you do. Check `git status` before assuming you need to stage. If clean but files exist, the remote is all you're missing.