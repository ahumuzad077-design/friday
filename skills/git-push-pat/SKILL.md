---
name: "Git Push with PAT"
description: "Push code from the Vellum container to a GitHub repo using a Personal Access Token stored in the credential vault. Simpler than the full GitHub App bot flow — commits attribute to the token owner."
metadata:
  vellum:
    emoji: 📤
    activation-hints:
      - User asks to push code to GitHub
      - User needs git push access from inside the container
      - "User provides a git@github.com: URL and needs setup"
      - Goal is to publish a plugin or repo from the workspace
    avoid-when:
      - User wants a bot identity (commits attributed to [bot]) — use the GitHub
        App setup flow instead
    category: development
---

# Git Push with Personal Access Token (PAT)

Push code from the Vellum container to a GitHub repo using a Personal Access Token. Simpler than the full GitHub App bot flow — commits attribute to the token owner, not a bot.

## When to use

- The user wants to push a plugin, codebase, or files to a GitHub repo from inside the container
- The user has (or can create) a GitHub PAT with `repo` scope
- The user does not need a bot identity (`[bot]` attribution is fine)
- The GitHub App setup flow seems like overkill

## Prerequisites

- The user must have a GitHub Personal Access Token (classic or fine-grained) with **repo** scope (or at minimum `contents:write` on the target repo).
- The workspace must be a git repository (`cd /workspace && git status` confirms).

## Procedure

### 1. Secure token entry

Use the credential prompt — never ask for the token in plain conversation text (secret messages may be blocked). The prompt blocks until the user submits:

```bash
assistant credentials prompt \
  --service github \
  --field token \
  --label "GitHub PAT" \
  --placeholder "ghp_..." \
  --description "Personal Access Token with repo scope" \
  --usage-description "Push code to GitHub"
```

The `--timeout_seconds` on the `bash` tool call must be at least **330s** (the default 120s will cut the prompt off).

### 2. Configure the remote

Reveal the stored token and set up the remote URL with embedded auth. The token is revealed to stdout, which we capture into a shell variable — never echo or log it:

```bash
TOKEN=$(assistant credentials reveal --service github --field token)
git remote add origin "https://x-access-token:${TOKEN}@github.com/OWNER/REPO.git"
# Or update an existing remote:
# git remote set-url origin "https://x-access-token:${TOKEN}@github.com/OWNER/REPO.git"
```

**Important:** The token is in a shell variable scope — it disappears when the bash tool returns. There is no secret-leak risk from this pattern.

### 3. Stage, commit, and push

```bash
cd /workspace
git add <paths>
git commit -m "<message>"
git push -u origin BRANCH
```

On first push, use `-u origin main` (or the target branch name) to set up tracking. On subsequent pushes, `git push` alone works if the remote tracking branch is already set.

### 4. (Optional) Add marketplace entry and pin

After pushing the plugin, add a `marketplace.json` to the plugin directory pointing at the commit:

```json
{
  "name": "<plugin-name>",
  "displayName": "<Display Name>",
  "description": "<description>",
  "category": "<category>",
  "source": {
    "owner": "OWNER",
    "repo": "REPO",
    "ref": "$(git rev-parse HEAD)",
    "path": "plugins/<plugin-name>"
  }
}
```

Commit and push the marketplace file too.

## Token lifetime and reuse

The stored credential persists in the vault until explicitly deleted. The token does not expire unless it was created with one. To reuse in a later session, just reveal it again — no need to re-prompt.

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `remote not found` | Wrong owner/repo in URL | Double-check the SSH-style URL the user gave (e.g. `git@github.com:owner/repo.git`) and convert: the owner/repo part is the same. |
| `403` on push | Token lacks repo scope, or token expired | Prompt for a fresh token with proper scopes. |
| `nothing to commit, working tree clean` when files exist | Files already auto-committed (heartbeat safety net) | Just add the remote and push — the commit already exists. |
| `credential prompt timed out` | bash tool timeout too short | Retry with `timeout_seconds` >= 330. |
