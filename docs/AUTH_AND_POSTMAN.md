# Authentication API and Postman testing

Base URL: `http://localhost:4000/api/v1` (health check: `http://localhost:4000/health`).

## How it works
- **Sign up / log in** return `{ user, accessToken, refreshToken }`.
- **Access token**: a signed JWT valid 15 minutes (`JWT_ACCESS_TTL`). Send it as `Authorization: Bearer <accessToken>`.
- **Refresh token**: random string stored in MongoDB per device, valid 30 days (`JWT_REFRESH_TTL`). `POST /auth/refresh` swaps it for a new pair; **each refresh token works once**. If an already-used one is presented again, every session of that user is revoked (token theft protection).
- **Passwords** are hashed with bcrypt (cost 12) and never returned. Rule: 8–72 characters, at least one letter and one number.
- **Limits**: 20 auth requests per minute per IP, plus 10 login attempts per 15 minutes per email/username. Unknown user and wrong password give the same answer and take the same time.

## Endpoints
| Method | Path | Auth | Body / query | Success |
|---|---|---|---|---|
| POST | `/auth/signup` | no | `email, username (3-24 letters/numbers/_), password, name, device?` | 201 `{user, accessToken, refreshToken}` |
| POST | `/auth/login` | no | `identifier` (email or username), `password`, `device?` | 200 `{user, accessToken, refreshToken}` |
| POST | `/auth/refresh` | no | `refreshToken` | 200 new `{user, accessToken, refreshToken}` |
| GET | `/auth/me` | Bearer | | 200 `{user}` |
| POST | `/auth/change-password` | Bearer | `currentPassword, newPassword` | 200 new tokens; other devices signed out |
| POST | `/auth/logout` | no | `refreshToken` | 204 |
| POST | `/auth/logout-all` | Bearer | | 204 (every device) |
| POST | `/auth/verify-email` | no | `token` (from the emailed link) | 200 `{verified:true}`; 400 `INVALID_TOKEN` if used/expired |
| POST | `/auth/resend-verification` | no | `email` | 202 (always, so it cannot reveal which emails exist) |
| POST | `/auth/forgot-password` | no | `email` | 202 (always); emails a link valid 1 hour |
| POST | `/auth/reset-password` | no | `token`, `newPassword` | 200; signs out every device; marks the email verified |
| GET | `/users` | Bearer | `?updatedSince=ISO date` | 200 list of people (id, username, name, interests) for follow/share lists |
| GET | `/auth/availability` | no | `?username=` and/or `?email=` | 200 `{username?: bool, email?: bool}` (true = free) |

Errors always look like `{ "error": { "code": "...", "message": "...", "details": ... } }`:
400/422 `VALIDATION_ERROR` (details lists the field), 401 wrong credentials / missing or expired token, 409 email or username in use, 429 `RATE_LIMITED`.

### curl examples
```bash
curl -X POST localhost:4000/api/v1/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","username":"me_1","password":"Secret123","name":"Me"}'
curl -X POST localhost:4000/api/v1/auth/login  -H 'Content-Type: application/json' \
  -d '{"identifier":"me_1","password":"Secret123"}'
curl localhost:4000/api/v1/auth/me -H "Authorization: Bearer $ACCESS"
```

## Postman (all 55 endpoints of the API)
1. Postman → **Import** → select both files in `postman/`:
   `Pacewise.postman_collection.json` and `Pacewise.postman_environment.json`.
2. Top-right environment dropdown → **Pacewise local**. Change `baseUrl`/`rootUrl` if the API is not on port 4000.
3. Run **1. Auth** requests top to bottom (or use *Run folder*). Tests save `accessToken`, `refreshToken`, `username`, `userId` automatically; every other request sends `Bearer {{accessToken}}` by itself.
4. Edit `newUsername` and `email` in the environment for each new account you create (a second signup with the same values correctly returns 409).
5. Then run **3. Stories** (saves `storyId`) before Social / Playlists / History. For Follow and Share set `otherUsername` to another account (for example a seeded demo user such as `hariom.nathani`).
6. Each request has built-in checks (Postman "Test Results" tab), including the negative cases: duplicate signup (409), weak password (422), wrong password (401), missing token (401), pushing another user's record (rejected).
7. **Logout** invalidates the refresh token; log in again to continue.

Typical manual test order: Health → Signup → Availability (shows `false`) → Login → Me → Refresh (old refresh token now dead) → Change password → Login with the new password → Logout.

## Frontend
Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`. The web app's login screen calls these same endpoints; there is no other login path.

## E-mail verification and password reset
1. In `.env` set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `APP_URL` (the address of the web app). Gmail: turn on 2-step verification, create an **App password**, use `smtp.gmail.com` / `587`. Other providers (Brevo, SendGrid, Resend, Amazon SES) work the same way with their SMTP details.
2. Sign-up sends a "confirm your email" link (`APP_URL/verify-email?token=…`, valid 24 h). Forgot password sends `APP_URL/reset-password?token=…` (valid 1 h).
3. `REQUIRE_EMAIL_VERIFICATION=true` makes sign-in refuse unconfirmed accounts (403 `EMAIL_NOT_VERIFIED`); sign-up then returns `verificationRequired: true` and no tokens. Leave it `false` until SMTP works.
4. Without SMTP settings nothing is sent: the email text and link are printed in the API's log, so you can test the whole flow locally by copying the token from the log into Postman (`emailToken` / `resetToken` in the environment).
5. Tokens are random 256-bit values; only their SHA-256 hash is stored, each works once, and asking for a new one cancels the old one. The e-mail endpoints allow 5 requests per hour per address.


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

Gmail: turn on 2-step verification, create an App password, put it in `SMTP_PASS`. Test with `npm run mail:test -- you@gmail.com`. Restart the server after editing `.env`.
