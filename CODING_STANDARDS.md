# Coding standards

Read at review. Each rule here is a judgement call; the mechanical ones run as tests in `src/repo-rules.test.ts`, so a new mechanical rule goes there.

## Domain

- **Glossary words.** Names, UI text and comments use the terms in `GLOSSARY.md`, never its _Avoid_ list. A new idea gets a glossary entry before it gets a name in code.
- **ADRs hold.** A change that touches an area an ADR in `docs/adr/` decides follows it, or comes with a new ADR that replaces it. (A Task in Later was once counted as missing its deadline, against ADR 0003.)
- **Flags stay distinct.** At Risk, Overdue, Unscheduled and Later each have one meaning; a message or count that mixes two of them is a bug, even when the numbers look right.

## Commands

- **Reads are reads.** A command or query that lists or gets something leaves the database as it found it. Create defaults once, where the command layer starts, not on first read.
- **Absent keeps, null resets.** In an update, a missing field keeps the stored value and `null` means "follow the default". A field that falls back to a default when missing quietly changes data the owner never touched.
- **Refusals explain.** A refused command returns a reason the UI can show in the owner's words, not a thrown error.

## UI

- **Phone first.** The owner uses dynacal mainly on an iPhone: labels stay short, layouts are designed at phone width first, and every control is a full-size touch target.
- **Words over numbers.** Show the owner a sentence ("Default (none)", "Moved to Later") over a raw value ("0", "later").
