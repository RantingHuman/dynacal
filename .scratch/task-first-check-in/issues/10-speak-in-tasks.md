# 10: Speak in Tasks, not Blocks

**What to build:** Nothing the owner sees says "Block". Toasts, errors, sheets, empty and error screens, settings and onboarding talk about the Task or its time ("Couldn't move Pack for vegas"). The "Minimum Block Length" setting is relabelled "Shortest split piece". "Block" stays as the internal and glossary term.

**Blocked by:** 04, 06, 08

**Status:** resolved

**Size:** S · **Spec user stories:** 1, 4, 5, 6, 7

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] No visible text or accessible name on the home screen, Task editor, settings, onboarding, empty or error screens contains the word "Block", checked by a test over the rendered screens.
- [ ] The setting reads "Shortest split piece" with a hint that it applies to Splittable Tasks.
- [ ] Toasts and errors name the Task (e.g. "Couldn't move Pack for vegas").
- [ ] Tests: component tests, including the no-"Block" check.
