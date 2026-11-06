# Self-hosting dynacal

dynacal runs as one Docker container for one person, using your own Google OAuth client. All its data lives in one SQLite file.

## 1. Google OAuth client

In the [Google Cloud console](https://console.cloud.google.com/):

1. Create a project and enable the **Google Calendar API**.
2. Under **Google Auth Platform**:
   - **Branding:** set a name and your email.
   - **Audience:** set it to **External**.
   - **Data access:** add the scope `https://www.googleapis.com/auth/calendar`.
3. Under **Clients**, create a **Web application** client:
   - Set its redirect URI to `<PUBLIC_BASE_URL>/api/auth/google/callback`.
   - Copy the client ID and secret.
4. Under **Audience**, click **Publish app**. While an app is in Testing, Google expires its tokens every 7 days. You don't need Google's verification review. When you sign in, Google warns the app is unverified: choose **Advanced → Go to dynacal**.

## 2. Web push keys

```bash
npx web-push generate-vapid-keys
```

Keep this pair. If you replace it, reminders must be switched on again in every browser.

## 3. Configure

Copy `.env.example` to `.env` and fill it in. dynacal won't start if a required value is missing.

| Variable | Meaning |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From step 1 |
| `OWNER_EMAIL` | Your Google account. Only it can sign in. |
| `PUBLIC_BASE_URL` | Where you reach dynacal, with no trailing slash |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | From step 2 |
| `DATABASE_PATH` | Optional. Defaults to `/data/dynacal.db`. |

## 4. Run

```bash
docker build -t dynacal .
docker run -d --name dynacal --restart unless-stopped -p 3000:3000 --env-file .env -v dynacal-data:/data dynacal
```

- **Keep it running:** calendar sync and reminders run inside the container.
- **Back up:** stop the container, then copy `dynacal.db` out of the `dynacal-data` volume. The file holds your Google token, so keep backups private.
- **HTTPS:** to reach dynacal from outside your network, put it behind a reverse proxy that serves HTTPS, such as Caddy, and set `PUBLIC_BASE_URL` to that address.
- **Instant sync:** with a public `https://` address and a valid certificate, Google tells dynacal about calendar changes within seconds. `<PUBLIC_BASE_URL>/api/google/calendar-notifications` must be reachable from the internet with no extra sign-in. Without this, dynacal syncs every 5 minutes.

## 5. Set up

Open `PUBLIC_BASE_URL` and sign in with `OWNER_EMAIL`. Setup then has you:

1. Connect your Google Calendar.
2. Choose the calendars to plan around.
3. Set your hours.

For reminders, choose **Enable reminders** in each browser you use. On iPhone, add dynacal to your Home Screen first and open it from there.

To cut off dynacal's access, remove it under [Google account → Third-party apps & services](https://myaccount.google.com/connections).
