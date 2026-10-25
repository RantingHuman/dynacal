# 04: Prefactor: the dynacal calendar can hold more than Blocks

**What to build:** Prepare syncing the dynacal calendar for a second kind of event, with no change in behaviour. The calendar gateway can read and write the dynacal calendar's events of any kind, including all-day ones, and every event dynacal writes carries a private marker recording its kind and dynacal id. Block sync (writing Blocks, and applying the owner's Google edits to Blocks) moves onto this generalised path unchanged. See spec "Syncing the dynacal calendar" and Further Notes, and ADR-0002's amendment.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The gateway's dynacal-calendar operations are generalised so they read and write events of any kind, including all-day events, and return each event's kind and dynacal id from its private marker
- [x] Every event dynacal writes to the dynacal calendar carries the private marker; Block events written before this change (without a marker) are still recognised as Blocks
- [x] Block sync uses the generalised operations; all existing Block sync, Google-edit, pinning, Declined Time and connection-health tests pass unchanged
- [x] The fake calendar gateway models the dynacal calendar holding events of more than one kind, all-day events in it, and the private marker, behaving as Google does
- [x] The real Google adapter maps the private marker and all-day events; anything untested against real Google is listed in the completion report
