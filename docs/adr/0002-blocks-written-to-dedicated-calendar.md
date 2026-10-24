# Blocks are written to a dedicated calendar

The app writes each Block to the user's Google account as an event in a separate calendar that dynacal owns, rather than keeping Blocks only in the app or writing them into the user's primary calendar. This lets the Schedule show up in any Google Calendar client, which matters because the MVP is web-only. Keeping Blocks in their own calendar means the app never edits the user's real Events. The cost is that when reading busy time, the app must exclude its own calendar so it doesn't treat its own Blocks as Events.
