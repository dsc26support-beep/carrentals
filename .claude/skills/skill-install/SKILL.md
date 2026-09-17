---
name: skill-install
version: 1.0.0
description: How to install, add, enable, set up, or update a Claude skill across every surface — local Claude Code (~/.claude/skills), a repository (.claude/skills), and claude.ai browser chats (Settings upload). Use when the user asks to install a skill, add a skill, set up a skill, enable a skill, where skills live, why a skill isn't triggering, how to package a GitHub skill repo, or how to make a skill available in Claude Code or claude.ai. Does not activate for general coding, writing, or non-skill-management tasks.
---

## What this skill does

Guides the user through installing a Claude skill on the right surface. A skill
is a folder containing a `SKILL.md` (YAML frontmatter with `name` + `description`,
then a Markdown body) plus any `references/` or asset files. Where that folder
goes decides where the skill is available.

**First, always identify the surface**, then follow the matching section. If the
user hasn't said which one, ask — the install location is completely different
for each.

| Surface | Where the skill lives | Scope |
| --- | --- | --- |
| Local Claude Code | `~/.claude/skills/<name>/` | Every session on that machine, any project |
| Local Claude Code (one project) | `<repo>/.claude/skills/<name>/` | Sessions in that project |
| Claude Code on the web (claude.ai/code) | `<repo>/.claude/skills/<name>/` in the repo | Every web/CLI session on that repo |
| claude.ai browser chats | Uploaded via **Settings → Capabilities → Skills** | All browser chats on that account |

---

## Hard rules

- Never claim a skill installed from an ephemeral remote/cloud session will
  persist. Files written to `~/.claude/skills/` in a remote container are lost
  when the container is reclaimed and never reach the user's own machine or
  their claude.ai account. To install user-level ("every session"), the user
  runs the command themselves on their own machine.
- A skill folder must contain a `SKILL.md` at its top level with valid
  frontmatter (`name`, `description`). Verify this before or after installing.
- The folder name should match the skill's `name` field.
- Do not upload or commit a skill without reading its `SKILL.md` first.

---

## 1. Local Claude Code — every session on the machine (user-level)

Available in every project on that machine. The user must run this on their own
machine (not from a remote session):

```bash
git clone https://github.com/<owner>/<repo>.git ~/.claude/skills/<skill-name>
```

Or, from an already-cloned copy:

```bash
mkdir -p ~/.claude/skills && cp -R ./<skill-folder> ~/.claude/skills/<skill-name>
```

Verify with `/skills` (or restart Claude Code). Update later with
`cd ~/.claude/skills/<skill-name> && git pull`.

## 2. A repository — project-scoped (works in Claude Code CLI *and* web)

Put the skill inside the repo so anyone working in it — including
claude.ai/code sessions — gets it automatically:

```
<repo>/.claude/skills/<skill-name>/SKILL.md
```

Copy the skill files in, commit, and push. This is the correct route to make a
skill available in **Claude Code on the web**, because web sessions load skills
from the repo, not from an account upload.

## 3. claude.ai browser chats — account upload

Custom skills can't be installed from a chat message or a GitHub URL. They are
uploaded through account settings (requires a plan/workspace with Skills
enabled):

1. Package the skill folder as a `.zip` (see below).
2. Go to **claude.ai → Settings → Capabilities → Skills**.
3. Choose **Upload skill** (or "Create custom skill") and select the `.zip`.
4. **Toggle the skill on.**

Menu wording shifts between plans/updates; the stable path is
**Settings → Capabilities/Skills → Upload**. If there's no Skills section, the
plan or workspace admin hasn't enabled skills.

---

## Packaging a GitHub skill repo for browser upload

```bash
git clone https://github.com/<owner>/<repo>.git <skill-name>
rm -rf <skill-name>/.git
zip -r <skill-name>.zip <skill-name>
```

The zip's top-level folder must contain `SKILL.md`. Hand the user the zip to
upload in Settings.

---

## Verifying an install

- Confirm `SKILL.md` exists at the skill folder's top level and has `name` +
  `description` in frontmatter.
- In Claude Code, run `/skills` — the skill should appear by its `name`.
- If it doesn't trigger: skills activate from the `description`, so the request
  must match what the description says the skill is for. Re-read the
  description; a too-narrow one is the usual cause.

## Common gotchas

- **"I want it everywhere" from a remote/web session** → user-level install must
  be run locally; from here, only the repo route (surface 2) persists. State
  this plainly instead of implying a global install happened.
- **Skill not showing up** → wrong folder depth (`SKILL.md` must be directly
  inside the named folder), or Claude Code needs a restart / `/skills` refresh.
- **Browser upload rejected** → the zip's root must be the skill folder
  containing `SKILL.md`, not the file alone.
