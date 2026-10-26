# 10: How is the redesign staged into implementation tickets?

Type: grilling
Status: resolved
Blocked by: 08, 09, 11, 12

## Question

Once every screen is decided, in what order should the phase 3 redesign be built, and how is it cut into tickets for the spec? For example: the design tokens and the global reduce-motion rule first, then the home screen in the rail layout, then the Task editor, then the motion, then the other screens and the phone layout. Or one screen at a time, finished end to end. Which slices can ship alone without leaving the app half in the old style? And which need the calendar's code reworked first, such as Blocks keeping their keys across days for `<ViewTransition>` and touch dragging?

## Answer

Settled with the owner in one round of grilling. **One spec with ten tickets: the foundation first, then one surface at a time, each able to ship alone.**

1. **Foundation:**
   - colour and type tokens, with fonts through `next/font/google`;
   - focus rings and the motion tokens;
   - the global reduce-motion rule.

   All of it is applied to today's layouts. The whole app changes palette and type at once, so no later step leaves anything half old. Follows [What are the design tokens?](02-design-tokens.md).
2. **Prefactor, stable Block identity:** Blocks are drawn with a display key: the Task's id plus the Block's position among that Task's Blocks in time order (for example `t2#1`). There's no change to the database or sync, and no visible change.
   - This is needed because Recalculation deletes every future Block and inserts new ones with fresh IDs (`src/core/commands.ts:896-899`), so React keys don't survive it and "Blocks glide after Recalculate" can't work without it.
   - Reminders already key on Task and start, so nothing else depends on Block IDs.
3. **Home, desktop: masthead and headline.** The states, ranking, templates and standfirst from [What does the headline say in each state of the week?](04-headline-states.md).
4. **Home, desktop: the Tasks column.** The checkbox list, the one-line add and the full-page editor from [How do creating and editing a Task look?](06-task-editor.md).
5. **Home, desktop: the calendar.** The rail toolbar, Conflict strip, review box, floating label and Block checkboxes from [Where does each existing home-screen control live?](05-home-controls.md) and its later addition.
6. **Motion:** the five delight moments and the interaction table from [Which interactions get motion, and what does each do?](07-interactions.md). It needs step 2.
7. **Settings, setup and sign-in in prose**, with saving as you go and invalid values held unsaved. From [How do Settings, setup and sign-in look?](08-other-screens.md) and [What do the empty, loading and error states show?](11-empty-error-states.md).
8. **Phone (under 640px):** the tabs, the agenda and the Block sheet from [How does the home screen work at phone width?](09-phone-width.md). It needs steps 3–5.
9. **Empty, loading, error and offline states** from [What do the empty, loading and error states show?](11-empty-error-states.md). This includes offline caching: the service worker caches the last loaded home page and the static files, tries the network first and falls back to the cache. Nothing that changes data works offline.
10. **Reminders, the icon and the manifest** from [Does the redesign reach reminders and the installed app?](12-reminders-and-app.md).

Steps 7, 9 and 10 depend only on step 1, so they can run alongside steps 3–6.

**Testing.** Logic with real rules gets unit tests in Vitest:
- the headline's state choice and wording;
- the sentence parser for adding Tasks;
- grouping Working Hours into runs of days;
- holding invalid Settings unsaved;
- the reminder text;
- the display key.

Everything visual is checked by hand in a dev server, at desktop and phone widths, in light and dark and with reduce motion on, as phase 2 did.

**The prototype code.** Nothing is merged from `prototype/design-styles`. Each ticket rewrites properly and links the prototype route and commit it follows as a reference. The branch stays local and throwaway.
