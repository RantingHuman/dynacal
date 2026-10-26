# 21: Empty, loading, error and offline states

**What to build:**
- **Empty states:** one muted italic line plus the action that fills them: no Tasks ever; all done; a day with nothing on the phone.
- **No time zone:** an empty, dimmed week grid (or seven empty week list days on a phone).
- **Google broken or unreachable:** the last Events dynacal saw, drawn dimmer and dashed.
- **Loading:** a route-level loading screen (the masthead and a drawing squiggle) shown only after 300ms.
- **Actions:** save, add, complete and move update at once and roll back with a toast if refused; a button shows "…" after a second.
- **Errors:** one route-level error page in the editorial style, used by every screen.
- **Offline:** the service worker caches the last loaded home page and the static files, network first. Offline, the cached page shows "*Offline.* Showing your week as it was at HH:MM." and disables server actions. With nothing cached, the error page says "*You're offline.*"

See spec stories 97–106 and "States", and map ticket "What do the empty, loading and error states show?".

**Blocked by:** 13

**Status:** ready-for-agent

- [x] Each empty state shows its line and action
- [x] The no-time-zone and stale-Events views look as specified, while Tasks keep working
- [x] The loading screen never flashes on a fast load
- [x] Optimistic actions roll back with a reason when the server refuses
- [x] A thrown error anywhere shows the error page with "Try again" and "Back to the week", and the error in a muted line
- [x] Offline, the installed app shows the cached week with the offline line, and nothing that changes data can be attempted
- [ ] Checked by hand, including offline on an installed PWA
