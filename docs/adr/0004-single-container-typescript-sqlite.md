# Single container: TypeScript, Next.js, SQLite

Following ADR-0001, dynacal ships as one long-running Docker container: a Next.js app with SQLite (via Drizzle) stored in one mounted data file. The scheduler is a pure TypeScript module with no I/O. We chose this over Compose with Postgres or a serverless deployment because one container and one file is the easiest thing to self-host, and one person's data doesn't need a database server. Background work (calendar sync, reminders) runs inside the same process, so the container must stay running.
