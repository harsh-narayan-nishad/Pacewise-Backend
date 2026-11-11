# Pacewise backend: API endpoints

Base URL (local): `http://localhost:4000/api/v1`
Health check: `GET http://localhost:4000/health` and `GET http://localhost:4000/api/v1/health` return `{ "status": "ok", "uptime": <seconds> }`.

Every path below is relative to the base URL, so `POST /auth/login` means `POST http://localhost:4000/api/v1/auth/login`.

**Access column**
- **Public**: no token needed.
- **Optional**: works without a token, and knows who you are if you send one.
- **User**: header `Authorization: Bearer <accessToken>` is required.
- **Admin**: the same header, and the account must have the `admin` role.

**Format.** Requests and responses are JSON. Every request body, query and path parameter is checked by a zod schema before the controller runs. A bad request returns **400** with the field messages. Wrong or missing token returns **401**. Banned, pending or rejected accounts return **403** with a `code` such as `ACCOUNT_BANNED`. Too many tries returns **429**.

---

## 1. Auth: `/auth`

| Method | URL | Access | What it does |
|---|---|---|---|
| POST | `/auth/signup` | Public | Creates an account. Body: `email`, `username` (3-24, letters/digits/underscore), `password` (8-72, a letter and a number), `name`, optional `device`. Sends the confirmation mail (6-digit code and link) and a welcome mail. Returns the user, and tokens when sign-in is allowed right away. When `REQUIRE_EMAIL_VERIFICATION=true` it returns `verificationRequired: true` and no tokens. When `REQUIRE_ADMIN_APPROVAL=true` it returns `approvalRequired: true`. |
| POST | `/auth/login` | Public | Body: `identifier` (email or username), `password`, optional `device`. Returns the user, an access token (15 min) and a refresh token. Blocked with 403 if the account is banned, pending, rejected, or the e-mail is not confirmed yet. |
| POST | `/auth/google` | Public | Body: `idToken` (the credential Google gives the browser), optional `device`. The server asks Google to verify the token and checks it was issued for `GOOGLE_CLIENT_ID` and that the e-mail is verified. Existing account: signs in. New e-mail: creates the account (no confirmation code needed) and returns tokens, or `approvalRequired: true` when an admin must approve it. Banned, pending and rejected accounts get 403. Returns 503 `GOOGLE_NOT_CONFIGURED` if the server has no `GOOGLE_CLIENT_ID`. |
| POST | `/auth/refresh` | Public | Body: `refreshToken`. Swaps it for a new pair. The old refresh token is used up. Reusing an old one revokes all sessions of that person. |
| POST | `/auth/logout` | Public | Body: `refreshToken`. Ends this one session. |
| POST | `/auth/logout-all` | User | Ends every session on every device. |
| GET | `/auth/me` | User | The signed-in user. |
| POST | `/auth/change-password` | User | Body: `currentPassword`, `newPassword`. |
| GET | `/auth/availability` | Public | Query `?username=` or `?email=`. Tells whether it is free (used by the sign-up form). |
| POST | `/auth/verify-email` | Public | Body: `token` (from the e-mail link). Confirms the e-mail. |
| POST | `/auth/verify-email-otp` | Public | Body: `email`, `otp` (6 digits). Confirms the e-mail with the code. The code is valid 10 minutes, works once, and locks after 5 wrong tries. |
| POST | `/auth/resend-verification` | Public | Body: `email`. Sends a new link and code. Always answers 202, so nobody can use it to find out which e-mails are registered. |
| POST | `/auth/forgot-password` | Public | Body: `email`. Sends a reset link and a 6-digit code. Always 202. |
| POST | `/auth/reset-password` | Public | Body: `token`, `newPassword`. Resets with the link. |
| POST | `/auth/reset-password-otp` | Public | Body: `email`, `otp`, `newPassword`. Resets with the code. |

## 2. Users: `/users`

| Method | URL | Access | What it does |
|---|---|---|---|
| GET | `/users` | User | People directory (list of users). |
| GET | `/users/:username` | Public | One public profile with follower counts. |
| PATCH | `/users/me` | User | Edit your own profile (name, bio, avatar and similar). |
| POST | `/users/:username/follow` | User | Follow someone. |
| DELETE | `/users/:username/follow` | User | Unfollow. |
| GET | `/users/:id/followers` | Public | Who follows this person (by user id), newest first: `id`, `username`, `name`, `avatarUrl`. Query `page`, `pageSize` (up to 100). |
| GET | `/users/:id/following` | Public | Who this person follows, same shape. |

## 3. Stories: `/stories`

| Method | URL | Access | What it does |
|---|---|---|---|
| GET | `/stories` | Public | List and search. Query: `q`, `tag`, `authorUsername`, `page` (default 1), `pageSize` (default 20, max 100). |
| GET | `/stories/:id` | Public | One story with its text, questions and media. |
| POST | `/stories` | User | Create a story. Body: `title`, optional `description`, `level`, `estimatedWPM`, `tags`, `paragraphs`, `questions` (`question`, `options`, `correctIndex`), `media` (`kind` pdf or image, `pages`, `estimatedWordCount`). |
| PATCH | `/stories/:id` | User | Edit your story (any of the fields above). |
| DELETE | `/stories/:id` | User | Delete your story. |

## 4. Social: reactions, comments, shares, bookmarks (mounted at the API root)

| Method | URL | Access | What it does |
|---|---|---|---|
| PUT | `/stories/:storyId/reaction` | User | Body: `type` = `LIKE` or `DISLIKE`. Sets your reaction. |
| DELETE | `/stories/:storyId/reaction` | User | Removes your reaction. |
| GET | `/stories/:storyId/comments` | Public | Comments of a story. |
| POST | `/stories/:storyId/comments` | User | Body: `text` (max 2000). |
| DELETE | `/comments/:commentId` | User | Delete your comment. |
| POST | `/stories/:storyId/share` | User | Body: `receiverUsername`. Shares a story with another user (they get a notification). |
| PUT | `/stories/:storyId/bookmark` | User | Bookmark or un-bookmark a story. |

## 5. Notifications: `/notifications` (all User)

| Method | URL | What it does |
|---|---|---|
| GET | `/notifications` | Your notifications. |
| GET | `/notifications/stream` | Live stream (server-sent events) of new notifications. |
| POST | `/notifications/:id/read` | Mark one as read. |
| POST | `/notifications/read-all` | Mark all as read. |

## 6. Playlists: `/playlists`

| Method | URL | Access | What it does |
|---|---|---|---|
| GET | `/playlists/public/:userId` | Public | A person's public playlists. |
| GET | `/playlists/:id` | Optional | One playlist. Private ones only for the owner. |
| GET | `/playlists` | User | Your playlists. |
| POST | `/playlists` | User | Body: `name`, optional `isPublic`. |
| PATCH | `/playlists/:id` | User | Body: `name` and/or `isPublic`. |
| DELETE | `/playlists/:id` | User | Delete a playlist. |
| POST | `/playlists/:id/items` | User | Body: `storyId`. Adds a story. |
| DELETE | `/playlists/:id/items/:storyId` | User | Removes a story. |

## 7. Reading history, topics and weekly report: `/history` (all User)

| Method | URL | What it does |
|---|---|---|
| POST | `/history` | Saves one reading session. Body: `wpm`, `minutes`, `completed`, optional `storyId`, `breakMs`, `breakCount`, `effectiveWpm`, `reductionPercent`, `accuracy`, `totalQuestions`, `correctAnswers`, and `topics`: a list of `{ topic, correct, total }`. The topic counts must add up to `totalQuestions` and `correctAnswers`, otherwise 400 `TOPICS_MISMATCH`. Returns the session with each topic's `accuracy` and `level`. |
| GET | `/history` | Your sessions, newest first. Query `page`, `pageSize`. Each item has `topics` (with `accuracy` and `level`), `topicsEditableUntil` and `topicsLocked`. |
| GET | `/history/stats` | Totals and averages over your sessions. |
| GET | `/history/highlights` | Best speeds, best quiz scores and active days for the last 4 weeks (landing page "Performance"). Optional `?today=YYYY-MM-DD`. |
| PATCH | `/history/:id/topics` | Body: `topics` (list of `{ topic, correct, total }`). Renames or regroups the topics of one attempt. Allowed only for **2 days** after the test; later it returns 403 `TOPICS_LOCKED`. Topics that end up with the same name are merged. The counts must still add up to the test result, so the score can never be changed this way (400 `TOPICS_MISMATCH`). |
| GET | `/history/weekly-report` | Your last 7 days as JSON: reading minutes, sessions, average and best speed, change vs the week before, tests taken, average accuracy, active days out of 7, streak, a per-day strip, and your topics grouped as strong, medium and weak. |
| POST | `/history/weekly-report/send` | E-mails that report to you now. Limit: 3 per hour. |

**Strong, medium, weak.** The level is worked out by the server from the counts, never sent by the client: accuracy of 75% or more is *strong*, 50% to 74% is *medium*, below 50% is *weak*. Questions without a topic label use their chapter, then "General".

**Weekly e-mail for everyone.** `npm run report:weekly` sends the report to every verified, active user who was active in the last 14 days. Run it once a week from a scheduler, for example every Sunday at 18:00 with cron: `0 18 * * 0 cd /path/to/speed-reader-backend && npm run report:weekly`.

## 7b. Calendar: `/calendar` (all User)

Your own calendar events (shown in the Calendar tab of the profile). Only you can see or change them.

| Method | URL | What it does |
|---|---|---|
| GET | `/calendar/events` | Your events, oldest first. Optional `?from=<date>&to=<date>` returns only events that overlap that window. |
| POST | `/calendar/events` | Create an event: `title` (1 to 120 characters), `start`, `end` (not before start), optional `allDay`, optional `variant` (`primary`, `secondary`, `outline`). |
| PATCH | `/calendar/events/:id` | Change any of those fields (move, resize, rename, recolour). |
| DELETE | `/calendar/events/:id` | Delete one event. |

## 8. Tracking: `/tracking` (all User)

Time spent and counters, kept on the server so the numbers survive a browser clear.

| Method | URL | What it does |
|---|---|---|
| POST | `/tracking/events` | Body: `events` (1-200). Each is a `time` event (`day`, `kind` story/doc/reader, `itemId`, `ms`, ...) or a `count` event (`testsTaken`, `storiesRead`, `docsRead`). Every event has a unique `opId`, so sending it twice counts once. One event can claim at most 6 hours. |
| GET | `/tracking/summary` | Totals for streaks and daily activity. Query `today`, `minActiveMs`. |
| GET | `/tracking/state` | Your saved app state (all blobs). |
| PUT | `/tracking/blobs/:key` | Body: `value`, optional `rev`. Saves one blob. `key` is one of `history`, `streak`, `daily`, `bookmarks`, `achievements`, `customStories`, `searchHistory`, `timelog`, `doctime`, `settings`. A stale `rev` is refused so a second device cannot overwrite newer data. |

## 9. Sync: `/sync` (all User)

| Method | URL | What it does |
|---|---|---|
| POST | `/sync/ops` | Body: `ops` (1-300), each `{ op: "put", collection, id, data }` or `{ op: "delete", collection, id }`. Pushes local changes. |
| GET | `/sync/snapshot` | Query `since` (a timestamp number, default 0). Returns everything changed after it. |

## 10. Uploads: `/uploads`

| Method | URL | Access | What it does |
|---|---|---|---|
| POST | `/uploads/presign` | User | Body: `filename`, `contentType`. Returns a short-lived upload address (needs S3 settings in `.env`). Rate limited. |
| GET | `/uploads/:key/url` | Public | Returns a download address for an uploaded file. |

## 11. Reports: `/reports`

| Method | URL | Access | What it does |
|---|---|---|---|
| POST | `/reports` | User | Report something. Body: `targetType` (`story`, `comment`, `user`), `targetId`, `reason` (`spam`, `harassment`, `inappropriate`, `misinformation`, `impersonation`, `other`), optional `details` (max 1000). Limit: 10 per hour per person. |

## 12. Admin: `/admin`

| Method | URL | Access | What it does |
|---|---|---|---|
| POST | `/admin/login` | Public | Body: `identifier`, `password`. Signs in, only if the account is an admin. |
| POST | `/admin/google` | Public | Body: `idToken` (from Google), optional `device`. Signs in with Google, only if that e-mail already belongs to an admin account. It never creates an account. Others get 403 `NOT_ADMIN`. |
| GET | `/admin/metrics/overview` | Admin | Counts: users by status, online, idle, offline, open reports. Query `includeDemo` (true/false). |
| GET | `/admin/users` | Admin | List and filter. Query: `status`, `role`, `presence`, `q`, `sort` (`created` or `seen`), `includeDemo`, `page`, `limit` (max 100). |
| GET | `/admin/users/:id` | Admin | One user in detail. |
| POST | `/admin/users/bulk-approve` | Admin | Body: `ids` (1-100). Approves many. |
| POST | `/admin/users/:id/approve` | Admin | Approves a pending account and sends the approval mail. |
| POST | `/admin/users/:id/reject` | Admin | Body: optional `reason`. Declines, with a mail. |
| POST | `/admin/users/:id/ban` | Admin | Body: `reason` (required, 3-500). Permanent: the person cannot sign up again with that e-mail (dots, `+tags` and googlemail are treated as the same inbox). |
| POST | `/admin/users/:id/unban` | Admin | Body: optional `reason`. |
| POST | `/admin/users/:id/make-admin` | Admin | Gives the admin role. |
| POST | `/admin/users/:id/remove-admin` | Admin | Takes it away. The last admin can never be removed. |
| POST | `/admin/users/:id/revoke-sessions` | Admin | Signs the person out everywhere. |
| GET | `/admin/reports` | Admin | Query `status` (`open`, `reviewing`, `resolved`, `dismissed`), `targetType`, `page`, `limit`. |
| PATCH | `/admin/reports/:id` | Admin | Body: `status`, optional `resolution`. |
| POST | `/admin/content/remove` | Admin | Body: `type` (`story` or `comment`), `id`, optional `reportId`, `reason`. Removes reported content. |
| GET | `/admin/audit` | Admin | Who did what and when. Query `page`, `limit` (max 100). |

Admin rules enforced on the server: no one can ban or demote themselves, admins cannot be banned, and the last admin cannot be removed. Every action is written to the audit log. Admin routes allow 240 requests per minute.

---

# Types: what they are and why they exist

The backend is TypeScript, and "types" show up in four places. Each one exists to stop a specific kind of bug.

**1. Request schemas (`*.schema.ts`, zod).** A TypeScript type disappears when the code is compiled, so it cannot check what a stranger sends over the internet. A zod schema is checked while the server runs. Every route runs its schema first (`validate({ body: ... })`), so a controller only ever sees data of the right shape: an e-mail that looks like an e-mail, a password that follows the rules, a page size of at most 100. This is the first line of defence against bad or malicious input, and it gives the person a clear message instead of a crash.

**2. Inferred types (`export type SignupInput = z.infer<typeof signupSchema>`).** The type is derived from the schema, so there is one definition, not two. If a rule changes (say the username may be 30 characters), the check and the type change together and can never disagree. The compiler then flags any code that no longer fits.

**3. Environment type (`src/config/env.ts`).** All `.env` values are read once and validated at start-up. A missing `MONGODB_URI` or a JWT secret shorter than 32 characters stops the server immediately with a clear message, instead of failing later in the middle of a request. The rest of the code uses `env.PORT`, `env.APP_URL` and so on, typed and autocompleted, never raw `process.env`.

**4. Model types (`src/models`, Mongoose).** One model per collection: `User`, `RefreshToken`, `AuthToken` (e-mail link tokens and OTPs), `Story`, `Reaction`, `Comment`, `Share`, `Bookmark`, `Follow`, `Notification`, `Playlist`, `ReadingSession`, `SyncRecord`, `Counter`, `DailyActivity`, `ItemTime`, `UserBlob`, `Report`, `AuditLog`, `BannedIdentity`. They define what is stored, the indexes that keep queries fast, and the public shape: ids are exposed as `id`, and `passwordHash` is never sent out.

**Smaller types with a purpose**
- `AccessTokenPayload` (`utils/jwt.ts`): exactly what is inside the login token, so code reading the token cannot assume a field that is not there.
- `Mail` and the `...Mail()` builders (`utils/mailer.ts`): every e-mail has the same shape (`to`, `subject`, `text`, `html`), so sending code stays the same for signup, OTP, reset, welcome and approval mails.
- `ListUsersQuery`, `listReportsQuery` and the admin schemas: filters and paging for the admin screens are validated the same way as everything else.
- The sync and tracking policies (`sync/policy.ts`, `tracking/consistency.ts`) and the admin rule set (`admin/admin.policy`, `checkAdminAction`) are written as small pure functions with their own types. Having no database inside them makes them easy to unit test, and these are the rules where a mistake would be expensive (losing data, banning the wrong person).

**Why all this is worth it:** wrong input is stopped at the door, the code and the checks cannot drift apart, configuration mistakes show up at start-up, and the compiler finds broken changes before a user does.
