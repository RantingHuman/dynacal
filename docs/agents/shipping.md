# Shipping a branch

## Before merging

1. Run `pnpm check` and see it pass. It needs Docker: on this Mac Docker runs in OrbStack, so if the Docker socket is missing, start it with `orb start`.
2. Push the branch, so CI runs on it before it reaches `main`. Each push to GitHub needs the owner's go-ahead.
3. Read the result with `gh run watch <run-id> --exit-status`, run in the background so its end wakes you. `gh run list --commit <sha>` gives the id.
4. Merge into `main` locally, once CI is green and the owner has said to merge. No PRs: the owner doesn't use them. Pushing `main` runs CI again; read that result too.

## Deploying to the owner's container

Deploy only what has passed CI. Run `scripts/deploy.sh <backup-name>`, with a name saying what the backup comes before. It builds, backs up the stopped data to `~/dynacal-backups/<backup-name>`, swaps the container and checks a copy of the database, and it says so if anything needs a look. The backup holds the Google refresh token: keep it on this machine.
