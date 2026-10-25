# 03: Rolling Week view and Copy Working Hours

**What to build:** Two small UI changes. The Week view shows seven days starting today instead of the Monday-to-Sunday week containing today. In Settings, each Working Hours day gets a "Copy to…" action that copies its windows to other days. See spec stories 17–18 and 43–46.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Week view opens on seven days starting today; Previous and Next move seven days at a time and stay within the Planning Horizon; the Day view is unchanged
- [ ] Each Working Hours day has a "Copy to…" action listing the other days, with "Weekdays" and "All days" shortcuts
- [ ] Copying replaces the chosen days' windows with the source day's windows (it doesn't add to them)
- [ ] Copied changes stay unsaved until Save, and saving goes through the existing settings validation
- [ ] Both are checked by hand in a dev server (agreed: no new test seam), including at phone width
