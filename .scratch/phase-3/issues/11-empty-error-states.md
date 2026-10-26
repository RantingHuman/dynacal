# 11: What do the empty, loading and error states show?

Type: grilling
Status: resolved
Blocked by: none

## Question

Beyond the headline, what do the Task list, the calendar (desktop rail and the phone agenda) and Settings show in each empty, loading and error state, in "Editorial, refined"?

- **Empty:** no Tasks yet, every Task done, and nothing in a day or a week (desktop grid and phone agenda).
- **Missing setup:** no time zone, so there's no calendar at all.
- **Google trouble:** the connection broken or unreachable.
- **Loading:** the first load, Recalculation, saving, and a refused move.
- **Invalid Settings:** now that Settings saves as you go, what happens to a value that isn't valid (overlapping windows, an end before its start)? Is it held unsaved with an inline message, or something else?

The headline's words are settled in [What does the headline say in each state of the week?](04-headline-states.md). Where notices sit is settled in [Where does each existing home-screen control live?](05-home-controls.md) and [How does the home screen work at phone width?](09-phone-width.md). Motion follows [Which interactions get motion, and what does each do?](07-interactions.md).

## Answer

Settled with the owner in one round of grilling. Code facts that shaped it: the app has no `loading.tsx` or `error.tsx`, and Settings validation is already per field (`validateSettings` in `src/core/settings.ts`).

**Empty states** are one line of muted italic serif plus the action that fills them. No illustrations.
- **No Tasks ever:** under the one-line add, "*Nothing here yet.* Try 'Board memo 2h by fri'." The add field gets focus on desktop.
- **Every Task done:** the finished Tasks stay struck through under "*All done.*", with the squiggle drawn in once.
- **A day with nothing:** the desktop grid stays empty, since the hour lines are enough. The phone agenda says "*Nothing planned*".
- **A week with nothing:** only the headline says so ("*A quiet week.*").

**No time zone:** besides the headline takeover, the calendar shows an empty, dimmed grid of the current week with no hours on it. On the phone, the agenda shows the seven day headings with "*Nothing planned*" under each. Tasks work as normal.

**Google broken or unreachable:** besides the headline, the calendar keeps the last Events dynacal saw. They're drawn dimmer with a dashed edge, and "Uses the last Events dynacal saw" sits beside Recalculate. Blocks look normal, since dynacal owns them.

**The first load:** a minimal loading screen, only if loading takes more than 300ms. It has the masthead and an empty headline line where the squiggle draws itself in a loop. No grey skeleton boxes.

**Waiting for actions:** saving, adding, completing and moving a Block update right away and roll back if the server refuses, with a message giving the reason. If one takes over 1 second, its button shows "…". Recalculation keeps its own rippling squiggle (per [Which interactions get motion, and what does each do?](07-interactions.md)).

**Invalid Settings while saving as you go:**
- The invalid change is **held unsaved**, and its message shows inline under the sentence, in accent, using today's wording.
- Every other change keeps saving.
- The underlined value turns accent with a dashed underline, and its editor stays open until the value is valid or you press "Undo", which puts back the last saved value.
- It never half-saves.

**Unexpected errors:** one editorial error page, also used for sign-in and Settings:
- the masthead, then the headline "*Something went wrong.*";
- the standfirst "dynacal hit an error it didn't expect. Your Tasks and Blocks are safe.";
- "Try again" and "Back to the week";
- the error message in a muted line, for the self-hoster.

**Offline (the installed app):** if a copy of the page is cached, it shows as it was last loaded. A muted line under the masthead reads "*Offline.* Showing your week as it was at 09:12." Every action that needs the server is disabled with that reason. If nothing is cached, the error page says "*You're offline.*" Whether and how to cache is left to the spec and the staging ticket.

No glossary changes and no ADR.
