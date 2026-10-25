# 06: dynacal Events synced with Google

**What to build:** dynacal Events are written to the dynacal calendar in Google and kept in step both ways. Edits the owner makes in dynacal are written to Google; edits the owner makes to a dynacal Event in Google win and are taken into dynacal. Blocks in the same calendar keep their existing behaviour. See spec stories 28–29, 31–32, 35–39 and 42, and ADR-0002's amendment.

**Blocked by:** 04 (Prefactor: the dynacal calendar can hold more than Blocks), 05 (dynacal Events in dynacal).

**Status:** resolved

- [x] Creating, editing and deleting a dynacal Event in dynacal creates, updates and deletes its event in the dynacal calendar, including all-day dynacal Events, with no writes when nothing changed
- [x] Each dynacal Event in Google carries a popup reminder at the Reminder Lead Time, and changing the Reminder Lead Time rewrites them
- [x] A dynacal Event moved or resized in Google takes its new time in dynacal; one deleted in Google is deleted in dynacal; title and notes edits in Google are taken into dynacal
- [x] Moving or deleting a dynacal Event in Google never creates a Pinned Block or a Declined Time, and Blocks in the dynacal calendar keep their existing Google-edit behaviour
- [x] The existing ordering holds: the owner's Google edits are applied before Recalculation and writing
- [x] Changes to dynacal Events made while the connection was broken are written after reconnect, and edits the owner made in Google during the outage still win
- [x] Command-layer tests with the fake calendar cover all of the above; anything untested against real Google is listed in the completion report
