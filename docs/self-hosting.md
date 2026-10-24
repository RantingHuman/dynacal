# Self-hosting dynacal

Each dynacal deployment belongs to one person: you. It runs as a single Docker container that keeps all of its data in one SQLite file on a mounted volume. To sign in, and later to read and write your calendar, it uses a Google OAuth client that you create yourself, so no one else's servers are involved.

## 1. Create a Google OAuth client

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and create a project, e.g. "dynacal".
2. Open **APIs & Services → Library** and enable the **Google Calendar API**. Sign-in doesn't need it, but calendar features will.
3. Open **Google Auth Platform** (formerly the OAuth consent screen) and configure it:
   - **Branding**: give the app a name (e.g. "dynacal") and your email as the support and developer contact.
   - **Audience**: choose **External**.
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
| `PUBLIC_BASE_URL` | yes | The URL you reach dynacal at, without a trailing slash. Use `https://` for anything reachable from the internet. |
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

## Local development

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` reads `.env` and stores data in `./data/dynacal.db`. Run the tests with `pnpm test`, and the type checker with `pnpm typecheck`.
