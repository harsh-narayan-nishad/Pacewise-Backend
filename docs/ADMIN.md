# Admin: approvals, bans, reports, online users

The admin page is a **separate app** (`speed-reader-admin`, port 3001). All the rules are enforced HERE, in the backend. The admin app only shows what the server allows.

## 1. One-time setup

| Step | Where | What |
|---|---|---|
| 1 | backend `.env` | `REQUIRE_ADMIN_APPROVAL=true` (default). New accounts can't sign in until you approve them. |
| 2 | backend `.env` | `CORS_ORIGINS=http://localhost:3000,http://localhost:3001` (add the admin app's address) |
| 3 | backend folder | `npm run admin:create -- you@gmail.com "YourPassword123" "Your Name"` creates YOUR admin account |
| 4 | admin app `.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` |
| 5 | admin folder | `npm install` then `npm run dev`, open http://localhost:3001 and sign in |

Restart the backend after editing `.env`. If the e-mail already has an account, step 3 turns it into an admin (and changes its password only if you pass one).

Approval and decline e-mails use the same SMTP settings as the confirmation codes (`SMTP_*`, `MAIL_FROM`, `APP_URL`). Without SMTP they are printed in the backend log.

## 2. Who can be an admin

- Only accounts with `role: "admin"`. Normal accounts get **403** from every `/admin/*` route, even with a valid token.
- The first admin comes from `npm run admin:create`. After that, an admin can make others in **Users > Make admin** (only approved accounts), and remove them again.
- Safety rules (checked on the server, unit-tested): you cannot ban or demote yourself, you cannot ban another admin (remove admin first), and there must always be at least one admin.

## 3. Sign-up approval

```
Sign up -> (confirm e-mail, if REQUIRE_EMAIL_VERIFICATION=true) -> status "pending"
        -> admin approves -> "active" (e-mail sent) -> can sign in
        -> admin declines -> "rejected" (e-mail sent) -> cannot sign in (can be approved later)
```
Sign-in answers for the app: `ACCOUNT_PENDING`, `ACCOUNT_REJECTED`, `ACCOUNT_BANNED` (HTTP 403, with a readable message). Accounts that existed before this feature count as approved. Pending / declined / banned people are hidden from the people directory.

## 4. Ban (permanent)

- Status becomes `banned`, every session is revoked, and further requests get 403 within ~15 seconds (status is cached 15 s per server process).
- The e-mail is stored in `BannedIdentity` in canonical form: lower-case, `+tag` removed, Gmail dots removed, `googlemail.com` = `gmail.com`. So `j.o.h.n+x@gmail.com` cannot sign up again after `john@gmail.com` was banned.
- **Unban** exists as an admin control (it removes the block). Leave it unused if you want bans to be final.

## 5. Online / offline

Every authenticated request records `lastSeenAt` (at most one write per person per 30 s; it does not touch `updatedAt`). The web app calls the API about every 15 s while open.

| Presence | Rule |
|---|---|
| online | seen in the last 2 minutes |
| idle | seen in the last 15 minutes |
| offline | anything older (or never) |

The overview also shows active today / 7 days / 30 days, sign-ups for the last 14 days, content counts and report counts. Demo accounts are excluded unless you tick "Include demo accounts".

## 6. Reports

People file reports with `POST /api/v1/reports` (signed in; 10 per hour):
```json
{ "targetType": "story | comment | user", "targetId": "...", "reason": "spam | harassment | inappropriate | misinformation | impersonation | other", "details": "optional" }
```
A copy of the reported text is saved, so the admin still sees it if the content is later removed. You cannot report your own content, or the same thing twice while the first report is open.

> The main web app does not have a "Report" button yet (it was left untouched on purpose). Until one is added, reports can be filed through this endpoint (Postman: folder 12).

Admin: filter by status/type, **Start review**, **Remove story/comment** (deletes it and closes all open reports on it), **Ban the author**, **Resolve** or **Dismiss** with a note.

## 7. Audit log

Every admin action (approve, decline, ban, unban, role change, sign-out, report outcome, content removal) is written to `AuditLog` with who, what, whom and when. The admin app shows it under **Audit log**. There is no endpoint to edit or delete entries.

## 8. Endpoints (all under `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/login` | Sign in; refuses non-admins (403 `NOT_ADMIN`) |
| GET | `/admin/metrics/overview` | Counts, presence, sign-ups, reports |
| GET | `/admin/users` | `status`, `role`, `presence`, `q`, `sort=created|seen`, `includeDemo`, `page`, `limit` |
| GET | `/admin/users/:id` | Detail + stats |
| POST | `/admin/users/:id/approve` \| `reject` \| `ban` (reason required) \| `unban` | Account state |
| POST | `/admin/users/:id/make-admin` \| `remove-admin` | Admin rights |
| POST | `/admin/users/:id/revoke-sessions` | Sign the person out everywhere |
| POST | `/admin/users/bulk-approve` | `{ "ids": [...] }` |
| GET | `/admin/reports` | `status`, `targetType`, `page` |
| PATCH | `/admin/reports/:id` | `{ "status", "resolution" }` |
| POST | `/admin/content/remove` | `{ "type": "story|comment", "id" }` |
| GET | `/admin/audit` | Audit trail |
| POST | `/reports` | File a report (any signed-in person) |

The admin app also uses `/auth/me`, `/auth/refresh` and `/auth/logout`. Postman: folders 11 and 12 (set `adminEmail` and `adminPassword` in the environment first).

## 9. Known limits

- Ban/approval changes reach other server processes within ~15 s (per-process cache), instantly on the process that handled the action.
- Presence is "last request seen", not a live socket: a person who closes the tab shows online for up to 2 minutes.
- Not run against a live MongoDB or Next.js in the environment this was written in. The pure rules (ban policy, canonical e-mail, presence) are unit-tested (`npm test`); run Postman folders 11 and 12 once to check the rest.
