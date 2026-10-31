# Shipping a branch

## Before merging

1. Run `pnpm check` and see it pass. It needs Docker: on this Mac Docker runs in OrbStack, so if the Docker socket is missing, start it with `orb start`.
2. Push the branch and open a draft PR, so CI runs on it before it reaches `main`. Merge only once CI is green and the owner has said to merge.

Each push to GitHub needs the owner's go-ahead.

## Deploying to the owner's container

The build and run commands are in `docs/self-hosting.md`, under "Build and run". Around them:

1. Build the new image first, so a failed build leaves the old container running.
2. Stop the container, then copy its volume to `~/dynacal-backups/<name>` (stopped, so the SQLite file is whole). This copy holds the Google refresh token: keep it on this machine.
3. Remove the old container and run the new one.
4. Check a copy of the live database, never the live file: every migration recorded in `__drizzle_migrations`, row counts as before, and `pragma foreign_key_check` empty.
