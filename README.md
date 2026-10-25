# dynacal

A self-hosted planner that turns your to-do list into a time-blocked schedule, fitted around what's already on your Google Calendar.

You give dynacal Tasks, each with an estimated duration, a deadline and a Priority. It finds free time within your Working Hours, places Blocks for each Task (splitting long ones when it needs to), and writes them to a dedicated "dynacal" calendar in your Google account, so your Schedule shows up in any Google Calendar app. When your calendar changes, it recalculates.

## Features

- **Scheduling around your real calendar.** Pick the Busy Calendars whose Events count as busy time. dynacal plans around them and never edits them.
- **Deadline-first, Priority-aware.** Tasks are placed earliest-deadline-first. When there isn't time for everything, the lower-Priority Task is the one that misses (see [ADR-0003](docs/adr/0003-deadline-first-priority-decides-misses.md)). Tasks that can't make their deadline are flagged At Risk.
- **Hands-on when you want it.** Drag a Block to pin it, and Recalculation plans around it. You can also move, resize or delete Blocks from any Google Calendar app, and dynacal picks up the change.
- **Review what happened.** After a Block's time passes, mark its work as done, not done or partly done. Remaining time is rescheduled.
- **Reminders** through web push, a set lead time before each Block starts.
- **Instant sync** via Google push notifications when served over public HTTPS, with polling every 5 minutes as a fallback.
- **Yours alone.** Each deployment serves one person, with their own Google OAuth client, and keeps all its data in one SQLite file (see [ADR-0001](docs/adr/0001-self-hosted-single-tenant.md)).

## Quick start

dynacal runs as a single Docker container. You'll need a Google OAuth client and a web push key pair. [docs/self-hosting.md](docs/self-hosting.md) covers each step.

```bash
cp .env.example .env   # then fill it in
docker build -t dynacal .
docker run -d --name dynacal --restart unless-stopped -p 3000:3000 --env-file .env -v dynacal-data:/data dynacal
```

Open `PUBLIC_BASE_URL`, sign in with the `OWNER_EMAIL` Google account, and setup walks you through connecting your calendar.

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev         # http://localhost:3000, data in ./data/dynacal.db
pnpm test        # vitest
pnpm typecheck
```

Stack: Next.js, React, SQLite via Drizzle, and a pure TypeScript scheduler with no I/O ([ADR-0004](docs/adr/0004-single-container-typescript-sqlite.md)).

- `src/core/` holds the domain logic: the scheduler, Tasks, sync and reminders.
- `src/server/` holds runtime wiring: config, the Google Calendar client, and background jobs.
- `src/app/` holds the Next.js UI and API routes.
- `drizzle/` holds database migrations. After changing `src/core/db/schema.ts`, generate a new one with `pnpm db:generate`.

[GLOSSARY.md](GLOSSARY.md) defines the domain terms (Task, Block, Pinned Block, Busy Calendar and so on), and [docs/adr/](docs/adr/) records the main design decisions.

## License

[MIT](LICENSE)
