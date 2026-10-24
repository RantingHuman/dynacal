# Self-hosting dynacal

Each dynacal deployment belongs to one person: you. It runs as a single Docker container that keeps all of its data in one SQLite file on a mounted volume. To sign in, and later to read and write your calendar, it uses a Google OAuth client that you create yourself, so no one else's servers are involved.

## 1. Create a Google OAuth client

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and create a project, e.g. "dynacal".
2. Open **APIs & Services → Library** and enable the **Google Calendar API**. Sign-in doesn't need it, but connecting your calendar does.
3. Open **Google Auth Platform** (formerly the OAuth consent screen) and configure it:
   - **Branding**: give the app a name (e.g. "dynacal") and your email as the support and developer contact.
   - **Audience**: choose **External**.
   - **Data access**: add the scope `https://www.googleapis.com/auth/calendar` (listed as Google Calendar API, "See, edit, share, and permanently delete all the calendars you can access using Google Calendar"). dynacal uses it to read your Busy Calendars and, later, to write its Blocks to its own "dynacal" calendar.
4. Under **Clients**, create a client of type **Web application**:
   - **Authorized redirect URIs**: add `<PUBLIC_BASE_URL>/api/auth/google/callback`, for example `https://dynacal.example.com/api/auth/google/callback`. For local use, add `http://localhost:3000/api/auth/google/callback`.
   - Copy the **client ID** and **client secret**.
5. **Switch the app to "In production".** Under **Audience**, click **Publish app**. Don't skip this step: while an app is in "Testing", Google expires its refresh tokens after 7 days, which would disconnect your calendar every week. Personal use doesn't need Google's verification review. When you sign in, Google shows a "Google hasn't verified this app" warning; choose **Advanced → Go to dynacal** to continue.

## 2. Generate web push keys

dynacal uses web push for reminders. Generate a key pair once:

```bash
npx web-push generate-vapid-keys
```

## 3. Configure

dynacal is configured with environment variables. It won't start if any required variable is missing, and it prints which ones.

| Variable | Required | Meaning |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | yes | The OAuth client ID from step 1 |
| `GOOGLE_CLIENT_SECRET` | yes | The OAuth client secret from step 1 |
| `OWNER_EMAIL` | yes | Your Google account's email. Only this account can sign in. |
| `PUBLIC_BASE_URL` | yes | The URL you reach dynacal at, without a trailing slash. Use `https://` for anything reachable from the internet. Instant sync with Google needs it to be public `https://` (see step 7). |
| `VAPID_PUBLIC_KEY` | yes | Public key from step 2 |
| `VAPID_PRIVATE_KEY` | yes | Private key from step 2 |
| `DATABASE_PATH` | no | Where the SQLite file lives. Defaults to `/data/dynacal.db` in the container. |

Copy `.env.example` to `.env` and fill it in.

## 4. Build and run

```bash
docker build -t dynacal .
```

```bash
docker run -d --name dynacal --restart unless-stopped -p 3000:3000 --env-file .env -v dynacal-data:/data dynacal
```

Your data is in the `dynacal-data` volume and survives restarts and upgrades. To back up, stop the container (`docker stop dynacal`), which flushes everything into `dynacal.db`, then copy that file out of the volume.

Keep the container running all the time: calendar sync and reminders run inside it.

To reach dynacal from outside your network, put it behind a reverse proxy that terminates HTTPS (e.g. Caddy or Traefik), and set `PUBLIC_BASE_URL` to that HTTPS address.

## 5. Sign in

Open `PUBLIC_BASE_URL` and choose **Sign in with Google** using the `OWNER_EMAIL` account. Any other Google account is refused.

## 6. Connect Google Calendar

The first time you sign in, dynacal walks you through setup:

1. **Connect Google Calendar.** This is a second Google consent, separate from signing in, that grants calendar access. Connect the same `OWNER_EMAIL` account; any other account is refused. It uses the same redirect URI as sign-in, so there's nothing extra to register.
2. **Choose your Busy Calendars**: the calendars whose Events dynacal plans around. Your primary calendar is chosen to start with.
3. **Set your Working Hours and time zone.**

You can change Busy Calendars, and whether Events marked "free" or all-day Events count as busy, under **Settings** at any time. If Google access stops working, choose **Reconnect** in Settings.

You can also adjust your plan from any Google Calendar app, by editing Blocks in the "dynacal" calendar:

- **Move or resize a Block** and dynacal pins it at its new time, just as dragging it in dynacal does.
- **Delete a Block** to say "not then": dynacal schedules that time for the Task somewhere else. The Task itself isn't deleted.
- **Title and description** edits are put back at the next sync; edit the Task in dynacal instead.

## 7. Instant sync (push notifications)

dynacal rereads your Busy Calendars and the dynacal calendar every 5 minutes. On top of that, it can ask Google to notify it the moment something changes, so a new meeting or a Block you moved on your phone shows up within seconds.

Google only delivers these notifications to a **public `https://` address with a valid certificate** (not self-signed). So dynacal registers for them only when `PUBLIC_BASE_URL` starts with `https://`, and Google must be able to reach `<PUBLIC_BASE_URL>/api/google/calendar-notifications` from the internet. Behind a reverse proxy, make sure that path is passed through without any extra sign-in in front of it; dynacal checks every notification against a secret it shares only with Google.

On `http://` or `localhost`, there's nothing to set up and nothing breaks: dynacal logs that push notifications are off at startup and keeps syncing every 5 minutes. Notification channels last about a week; dynacal renews them a day before they expire, and polling carries on underneath in case a notification is ever missed.

dynacal stores the Google refresh token in its SQLite file, so treat backups of `dynacal.db` as secrets. To cut dynacal off, remove it at [Google account → Third-party apps & services](https://myaccount.google.com/connections).

## Local development

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` reads `.env` and stores data in `./data/dynacal.db`. Run the tests with `pnpm test`, and the type checker with `pnpm typecheck`.
