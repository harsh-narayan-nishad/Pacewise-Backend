# Backend setup: where to put every credential, and how to get each one

Follow the steps in order. Everything goes into ONE file in the backend folder: **`.env`**.

> The server reads **only** `.env`. Editing `.env.example` does nothing. After every change to `.env`, stop the server (Ctrl+C) and run `npm run dev` again.

## Step 0: create your `.env`

In a terminal, inside the `speed-reader-backend` folder:

```bash
cp .env.example .env
```
Open `.env` in any editor. You will fill in the lines below. Never share `.env`, never commit it, never send it in chat.

| Line in `.env` | What it is | Step |
|---|---|---|
| `MONGODB_URI` | Database address and password | 1 |
| `JWT_ACCESS_SECRET` | Secret that signs login tokens | 2 |
| `JWT_REFRESH_SECRET` | A second, different secret | 2 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | The e-mail account that sends OTP codes and links | 3 |
| `APP_URL`, `CORS_ORIGINS` | Where your web app and admin app run | 4 |
| `REQUIRE_EMAIL_VERIFICATION`, `REQUIRE_ADMIN_APPROVAL` | On/off switches | 4 |

---

## Step 1: MongoDB URI

**Option A: MongoDB Atlas (free, recommended)**

1. Go to https://www.mongodb.com/cloud/atlas and sign up.
2. Create a cluster: choose the free **M0** plan, any region near you, then **Create**.
3. **Database Access** (left menu) > **Add New Database User**. Choose a username (for example `pacewise`) and a password. Prefer letters and digits only. Give it **Read and write to any database**. Save the password somewhere safe.
4. **Network Access** > **Add IP Address**. Click **Add Current IP Address**. (For quick testing from changing networks you can allow `0.0.0.0/0`, but remove it before going live.)
5. **Database** > your cluster > **Connect** > **Drivers**. Copy the connection string. It looks like:
   ```
   mongodb+srv://pacewise:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with your real password (no `<` `>`), and add the database name `pacewise` between `.net/` and `?`:
   ```
   MONGODB_URI=mongodb+srv://pacewise:YourPassword123@cluster0.abcde.mongodb.net/pacewise?retryWrites=true&w=majority
   ```
7. If the password has special characters, encode them: `@` becomes `%40`, `#` becomes `%23`, `/` becomes `%2F`, `:` becomes `%3A`.

**Option B: MongoDB on your own computer**

Install MongoDB Community (or run `docker compose up -d mongo` from this folder), then use:
```
MONGODB_URI=mongodb://localhost:27017/pacewise
```

## Step 2: JWT secrets (two different random strings)

These are not given by any website. You generate them yourself. In the terminal, run this command **twice** (you must get two different outputs):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Each run prints a long string of letters and digits (96 characters). Paste one into each line:

```
JWT_ACCESS_SECRET=<first output>
JWT_REFRESH_SECRET=<second output>
```
Rules: at least 32 characters, the two must differ, and keep them private. If you change them later, everyone is signed out (that is the emergency "log out all users" switch). The refresh secret also protects the stored OTP codes.

## Step 3: E-mail (this is what sends the OTP and the confirmation link)

The server sends a 6-digit code **and** a link in these cases: sign-up (confirm e-mail), "send a new code", and forgot password. It also sends "your account is approved / declined" e-mails. All of them use the same five settings.

**Using a Gmail account (simplest):**

1. Sign in to the Gmail account that should send the mails.
2. Google Account > **Security** > turn on **2-Step Verification** (an App password is not available without it).
3. Open https://myaccount.google.com/apppasswords (or search "App passwords" in your Google Account).
4. Name it `Pacewise` and click **Create**. Google shows a **16-character password**. Copy it and remove the spaces.
5. Fill in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdefghijklmnop
   MAIL_FROM="Pacewise <yourname@gmail.com>"
   ```
   `SMTP_PASS` is the 16-character App password, **not** your normal Gmail password (that will be rejected).

All five must be filled to send real mail. If they are empty, nothing is sent: the mail text, link and OTP code are printed in the server terminal instead, which is handy for local testing.

Gmail allows roughly 500 mails per day. For more, use a mail service (Brevo, Resend, SendGrid, Amazon SES): create an account there, copy the **SMTP** host, port, username and password they show, and put them in the same five lines.

**Test it before relying on it:**
```bash
npm run mail:test -- yourname@gmail.com
```
It sends one test message. Check the inbox and the spam folder.

## Step 4: the remaining lines

```
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
REQUIRE_EMAIL_VERIFICATION=true
REQUIRE_ADMIN_APPROVAL=true
```
- `APP_URL`: where the web app runs. The link inside e-mails opens here. In production use your real address, for example `https://pacewise.example.com`.
- `CORS_ORIGINS`: every address allowed to call the API: the web app (`:3000`) and the admin app (`:3001`). Comma separated, no spaces, no trailing slash.
- `REQUIRE_EMAIL_VERIFICATION=true`: a person must enter the OTP (or click the link) before they can sign in. Turn it on **after** the mail test works, otherwise nobody can finish sign-up.
- `REQUIRE_ADMIN_APPROVAL=true`: you must also approve each new account in the admin app.

Leave `NODE_ENV`, `PORT`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` as they are.

## Step 5: start and create your admin

```bash
npm install
npm run dev
```
In the terminal you should see the database connect and a line about the mail setup being OK (or FAILED with the reason). Then create your own admin account (only if you will use the admin app):

```bash
npm run admin:create -- you@gmail.com "YourPassword123" "Your Name"
```

## Step 6: frontend and admin app addresses (a different file, in a different folder)

In the **frontend** folder, create `.env.local`, and the same in the **admin** folder:
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```
(it must end with `/api/v1`). Restart those apps after creating it.

## Step 7: check that the OTP works

1. Open the web app and sign up with an e-mail you can read.
2. You receive an e-mail with a **6-digit code** and a confirm link. The app shows a "Confirm email" screen: type the code. The code lasts **10 minutes**, works **once**, and is blocked after **5 wrong tries** (ask for a new code with "Send me a new code").
3. Forgot password sends a new 6-digit code the same way: use "I already have a code".
4. No mail arrived? Look in spam, then check the server terminal: errors are printed there.

With Postman: `POST /auth/verify-email-otp` `{ "email", "otp" }` and `POST /auth/reset-password-otp` `{ "email", "otp", "newPassword" }`.

---

## If something goes wrong

| Message or symptom | Cause and fix |
|---|---|
| `Invalid environment configuration ... Required` | `.env` is missing or a required line is empty. Run `cp .env.example .env` and fill step 1 and 2. |
| `JWT_... must be at least 32 characters` | Use the generated 96-character strings from step 2. |
| MongoDB: `authentication failed` | Wrong user or password in the URI. Special characters must be encoded (step 1.7). |
| MongoDB: `ENOTFOUND`, `timed out`, `could not connect` | Your IP is not allowed: Atlas > Network Access > add your current IP. Or the URI is wrong. |
| Mail: `Invalid login` / `535` | You used the normal Gmail password. Use the 16-character App password (2-Step Verification must be on). |
| Mail: `ECONNECTION` / timeout | Port or host wrong (`smtp.gmail.com` and `587`), or the network blocks SMTP. |
| Log says `SMTP_HOST / SMTP_USER / SMTP_PASS are not set` | One of the three is empty (most often `SMTP_USER=` left blank). Put your full Gmail address in `SMTP_USER`. |
| Log says `db: "test"` | The URI has no database name. Add `/pacewise` after `.net` so data goes to the `pacewise` database. |
| Frontend or admin shows "Backend not connected." | `.env.local` is missing in that app's folder, or the backend is not running. Create it (step 6), start the backend, restart the app. |
| No e-mail, but no error | One of the five SMTP lines is empty: the mail is only printed in the terminal. Fill all five. |
| E-mail in spam | Normal for a new sender. Mark it "not spam". A real mail service with your own domain fixes this. |
| `INVALID_CODE` | Wrong or expired code, or already used. Ask for a new one. |
| Cannot sign in after sign-up | E-mail not confirmed yet, or the account is waiting for admin approval (check the admin app, Approvals). |
| Browser: `CORS` error | The web or admin address is missing in `CORS_ORIGINS`. Add it and restart the backend. |

## Safety checklist

- `.env` is listed in `.gitignore`: keep it that way.
- Use different secrets and a different database for production than for your laptop.
- If a secret leaks (pasted in chat, committed), replace it: new JWT secrets, a new MongoDB password, a new Gmail App password (delete the old one in your Google Account).
