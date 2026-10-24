# 07: Web push reminders and installing the app on a phone

**What to build:** The owner can install dynacal on their phone's home screen and get a web push notification at the reminder lead time before each Block starts.

**Blocked by:** 04 (Basic scheduling and the calendar view).

**Status:** ready-for-agent

- [ ] The app has a PWA manifest and service worker, so it can be installed on a phone's home screen
- [ ] The owner can turn on push notifications; the subscription is stored
- [ ] A background job sends a push notification at the reminder lead time before each Block, naming the Task
- [ ] A Block that moves or is deleted before its reminder fires is reminded at its new time, or not at all
- [ ] Command-layer tests, using the fake clock and a fake push sender, cover when reminders fire and that reminders for moved or deleted Blocks are dropped
