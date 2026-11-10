# Pacewise backend (Express + TypeScript + MongoDB)

Stores everything the web app does: accounts, stories, likes/dislikes, comments, comment reactions,
shares, saves, playlists, follows, notifications, avatars, reading history, reading time and
streak/consistency data.

> **Status:** written without being able to install packages or reach a MongoDB in the authoring
> environment. The pure logic (permissions, streak maths) has passing unit tests; the Mongo-facing code
> has not been run against a live database. Follow "First run" and report anything that errors.

## First run (5 minutes)

```bash
cd speed-reader-backend
cp .env.example .env        # 1. open .env and paste your MongoDB URL into MONGODB_URI
                            #    (Atlas: mongodb+srv://USER:PASS@cluster/pacewise?retryWrites=true&w=majority)
                            #    also replace both JWT_* secrets with long random strings
npm install
npm run seed                # 2. creates the 100 demo accounts (user-001 … user-100) with their demo passwords
npm run dev                 # 3. API on http://localhost:4000  (health: /health and /api/v1/health)
```

Frontend and admin: in each app's own `.env.local`, set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`,
then restart its `npm run dev` process. Both apps show live backend status in their UI. From that moment likes, comments, follows, shares,
saves, playlists, notifications, avatars, reading history, reading time and streaks are written to MongoDB.
On Atlas, allow your IP under *Network Access*. Collections are created automatically on first write.

Only `MONGODB_URI` and the JWT secrets are required. For e-mail verification and forgot-password add the `SMTP_*`, `MAIL_FROM` and `APP_URL` values (see `.env.example` and `docs/AUTH_AND_POSTMAN.md`); without them the e-mails are printed in the server log. Demo logins: `seed/DEMO_ACCOUNTS.csv` (created by `npm run seed`, already e-mail-verified). Redis (several API instances) and S3 (PDF/image
uploads) are optional.

Authentication endpoints and the Postman collection: see [`docs/AUTH_AND_POSTMAN.md`](docs/AUTH_AND_POSTMAN.md) (collection in `postman/`).

## How data reaches MongoDB

| What | How | Collection |
|---|---|---|
| Accounts, tokens | `/auth/*` | `users`, `refreshtokens` |
| Likes, dislikes, comments, comment reactions, shares, saves, playlists, follows, notifications, avatars | `POST /sync/ops` (browser sends only what changed), `GET /sync/snapshot?since=N` (browser receives everyone else's changes, every 15 s) | `syncrecords` |
| Reading time per story / doc, daily activity, tests, streaks | `POST /tracking/events` (each event has a unique id, so retries never double count) | `dailyactivities`, `itemtimes` |
| History, streak, daily calendar, bookmarks, achievements, custom stories, search history, time logs | `PUT /tracking/blobs/:key` (sent automatically whenever the app saves them) | `userblobs` |
| Streak/consistency numbers | `GET /tracking/summary` (current streak, longest streak, active days, last-30-days) | computed from `dailyactivities` |

Rules enforced by the server (`src/modules/sync/policy.ts`, unit-tested): you can only create/change/delete
records that belong to you; a notification's recipient may mark it read; saves are private; private
playlists are visible only to the owner; unknown collections are rejected.

Native endpoints (stories, social, playlists, history, notifications + SSE stream, uploads) from the first
version still exist under `/api/v1` and now use MongoDB.

## Consistency / streak definition
A day counts when at least 1 minute of reading time was recorded (`minActiveMs`, default 60 000). The day is
the user's own calendar day (the browser sends it), so time zones never break a streak. A streak that has not
read *yet today* stays alive until the day ends. See `src/modules/tracking/consistency.ts`.

## Scripts
`npm run dev` · `npm run build && npm start` · `npm run seed` · `npm test`

## Docker
`docker compose up --build` starts MongoDB + the API on :4000 (run `docker compose exec api node -e …` or
`npm run seed` locally against `mongodb://localhost:27017/pacewise` to create the demo users).

## Known limits (honest)
- Last-write-wins sync: if the same record is edited on two devices offline, the later push wins.
- Stored values larger than ~1.5 MB (e.g. a very large uploaded PDF kept as a custom story) stay in the
  browser only; large files should use the `/uploads` (S3) route.
- Ids created before this version (`reaction-1` style) can collide between two browsers; new ids are unique.
- `playlistRelationships` are readable by any signed-in user (needed to show public playlists).
- Demo accounts have demo passwords: do not expose a seeded database publicly.


## OTP (6-digit code by e-mail)

Every verification and reset e-mail now carries a 6-digit code as well as the link.

| Method | Path | Body |
|---|---|---|
| POST | `/auth/verify-email-otp` | `{ "email", "otp" }` |
| POST | `/auth/reset-password-otp` | `{ "email", "otp", "newPassword" }` |

Rules: valid 10 minutes, single use, 5 wrong tries then the code is dead, stored only as an HMAC, wrong email and wrong code give the same `INVALID_CODE` error.

## Where to put your information

| What | File | Key |
|---|---|---|
| MongoDB connection | backend `.env` (copy of `.env.example`; the server reads ONLY `.env`) | `MONGODB_URI` |
| Token secrets (any long random strings) | backend `.env` | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| E-mail / OTP sender | backend `.env` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| Link base in e-mails | backend `.env` | `APP_URL` (e.g. `http://localhost:3000`) |
| Force verification | backend `.env` | `REQUIRE_EMAIL_VERIFICATION=true` |
| Backend address for the app | frontend `.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` |

Gmail: turn on 2-step verification, create an App password, set `SMTP_USER` to the Gmail account that created it, and put the 16-character App password (without spaces) in `SMTP_PASS`. `MAIL_FROM` should use that same sender address. A normal Gmail account password will not work. Test with `npm run mail:test -- you@gmail.com`; it exits with an error instead of claiming success if SMTP is missing or cannot authenticate. Restart the backend after editing `.env`.

## Admin

Approvals, permanent bans, reports and online metrics have their own app (`speed-reader-admin`). Setup, rules and endpoints: [docs/ADMIN.md](docs/ADMIN.md). Create the first admin with `npm run admin:create -- you@gmail.com "Password123" "Your Name"`.
