#!/usr/bin/env bash
# Deploys the current checkout to the owner's container: scripts/deploy.sh <backup-name>
# Builds first, so a failed build leaves the old container running. Backs up the stopped data volume to
# ~/dynacal-backups/<backup-name>, swaps the container, then checks a copy of the database. If the new container
# doesn't come up, the old image is started again. The copy holds the Google refresh token: it's deleted on exit,
# and the backup stays on this machine.
# The DEPLOY_* settings exist so the script can be tried on a throwaway container and volume.
set -euo pipefail

name="${1:?Usage: scripts/deploy.sh <backup-name>}"
cd "$(dirname "$0")/.."

container="${DEPLOY_CONTAINER:-dynacal}"
volume="${DEPLOY_VOLUME:-dynacal-data}"
image="${DEPLOY_IMAGE:-dynacal}"
port="${DEPLOY_PORT:-3000}"
env_file="${DEPLOY_ENV_FILE:-.env}"
build_context="${DEPLOY_BUILD_CONTEXT:-.}"
backup="${DEPLOY_BACKUP_ROOT:-$HOME/dynacal-backups}/$name"

[ -e "$backup" ] && { echo "A backup called $name already exists: choose another name." >&2; exit 1; }
[ -f "$env_file" ] || { echo "$env_file is missing." >&2; exit 1; }
previous_image="$(docker inspect --format '{{.Image}}' "$container")"

scratch="$(mktemp -d)"
restore_needed=false

start_container() {
  docker run -d --name "$container" --restart unless-stopped -p "$port:3000" --env-file "$env_file" \
    -v "$volume:/data" "$1" >/dev/null
}

finish() {
  status=$?
  rm -rf "$scratch"
  if [ "$restore_needed" = true ]; then
    echo "Deploy failed: starting the old image again." >&2
    docker rm -f "$container" >/dev/null 2>&1 || true
    start_container "$previous_image" && echo "The old image is running. Data backup: $backup" >&2
  fi
  exit "$status"
}
trap finish EXIT

counts() {
  sqlite3 "$1" "select 'tasks', count(*) from tasks union all select 'blocks', count(*) from blocks;"
}

echo "Building"
docker build -q -t "$image" "$build_context" >/dev/null

echo "Stopping $container and backing up to $backup"
restore_needed=true
docker stop "$container" >/dev/null
mkdir -p "$backup"
chmod 700 "$backup"
docker run --rm -v "$volume:/data:ro" -v "$backup:/backup" alpine sh -c 'cp -a /data/. /backup/'
chmod -R go-rwx "$backup"
# A copy, because SQLite can't open a WAL database in a folder it may not write to.
cp "$backup/dynacal.db" "$scratch/before.db"
before="$(counts "$scratch/before.db")"

echo "Starting the new container"
docker rm "$container" >/dev/null
start_container "$image"
for _ in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://localhost:$port/sign-in" || true)" = 200 ] && break
  sleep 1
done
[ "$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://localhost:$port/sign-in" || true)" = 200 ] || {
  echo "The new container isn't answering." >&2
  exit 1
}
# From here on the new container stays up: it has already migrated the data, so a failed check is for a person.
restore_needed=false

echo "Checking a copy of the database"
mkdir "$scratch/live"
docker cp -q "$container:/data/." "$scratch/live/"
live="$scratch/live/dynacal.db"
after="$(counts "$live")"
recorded="$(sqlite3 "$live" 'select count(*) from __drizzle_migrations;')"
expected="$(node -p "require('./drizzle/meta/_journal.json').entries.length")"
broken="$(sqlite3 "$live" 'pragma foreign_key_check;' | wc -l | tr -d ' ')"

failed=false
[ "$before" = "$after" ] || { echo "Row counts changed. Before: $before After: $after" >&2; failed=true; }
[ "$recorded" = "$expected" ] || { echo "$recorded migrations recorded, $expected expected." >&2; failed=true; }
[ "$broken" = 0 ] || { echo "$broken foreign key problems." >&2; failed=true; }
[ "$failed" = false ] || { echo "The new container is running, but needs a look. Data backup: $backup" >&2; exit 1; }

echo "Deployed. $(echo "$after" | tr '\n' ' ')migrations|$recorded, no foreign key problems. Data backup: $backup"
