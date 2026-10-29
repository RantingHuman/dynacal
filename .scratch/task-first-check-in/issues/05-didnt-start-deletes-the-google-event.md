# 05: Didn't start deletes the old Google event

**What to build:** dynacal keeps the link between a past Block and its Google event while the Block awaits a Check-in (today it drops it once the event ends). **Didn't start** deletes that event from Google, so Google shows the Task only at its new time; Finished and More time leave it as a record.

**Blocked by:** 02

**Status:** ready-for-agent

**Size:** S · **Spec user stories:** 28, 31

Done when every box below is ticked, typecheck and the full test suite pass, and the changed screens have been checked at phone width (390px). See the spec (`../spec.md`), ADR 0006 and the glossary terms Check-in, Splittable Task, Block and Remaining Duration.

- [ ] With the fake calendar gateway: after Didn't start, the past Block's Google event is deleted.
- [ ] After Finished or More time, the event stays in Google and dynacal stops tracking it.
- [ ] Google edits to ended events are still ignored.
- [ ] Without Google connected, nothing is written.
- [ ] Tests: core tests against the fake calendar gateway.
