# dynacal

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Running tests

Before running tests while building or fixing, or starting subagents to build tickets, read `docs/agents/testing.md`.

### Shipping

Before merging, deploying or calling a branch done, read `docs/agents/shipping.md`. Reviews check against `CODING_STANDARDS.md`.
