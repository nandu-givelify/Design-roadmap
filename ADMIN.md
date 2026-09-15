# Admin Panel — setup & operation

The admin panel lives at **`/admin`** on your existing Vercel deployment:

```
https://<your-app>.vercel.app/admin
```

Same project, same deploy, no second host to pay for or keep in sync.

---

## How access actually works

There is no admin password, and that is deliberate.

The roadmap app is a Vite single-page app: everything under `src/` is compiled
into JavaScript and sent to the browser. A password checked in that code is
readable by anyone who opens devtools, and can be skipped entirely by calling
Firestore directly. Any gate that lives in the bundle is decoration.

So access is decided in two places the browser can't reach:

1. **`ADMIN_EMAILS`** — a server-side environment variable listing who is an
   admin. It is read only inside `/api/admin/*`, which runs on Vercel's
   serverless runtime, never in the bundle.
2. **Firestore security rules** (`firestore.rules`) — these decide what an
   ordinary signed-in user can touch, independent of any UI.

Every admin request carries your Firebase ID token. The server verifies that
token with the Firebase Admin SDK and re-checks your email against
`ADMIN_EMAILS` **on every single call** — not once at login. Editing the
frontend, forging local state, or calling the API by hand gets you nothing.

The panel itself holds no credentials. It's a thin client over those endpoints.

---

## Setup

### 1. Create a service account key

The Firebase *client* SDK can only ever see the currently signed-in user. Listing
every account, changing someone else's password, or reading every board requires
the **Admin SDK**, which needs a service-account credential.

1. [Firebase console](https://console.firebase.google.com) → your project
2. ⚙️ **Project settings** → **Service accounts** tab
3. **Generate new private key** → confirm → a `.json` file downloads

> This file is equivalent to full access to your entire Firebase project. It
> bypasses every security rule. Never commit it, never put it in `.env`, never
> paste it anywhere with a `VITE_` prefix — anything named `VITE_*` is compiled
> into the browser bundle. `.gitignore` already blocks the usual filenames.

### 2. Encode it

Raw JSON pasted into an environment-variable box often gets its `private_key`
newlines mangled. Base64 avoids that entirely:

```bash
base64 -i ~/Downloads/your-project-firebase-adminsdk-xxxxx.json | pbcopy
```

That copies a single long line to your clipboard. (The server accepts raw JSON
too, if you'd rather — it detects which one it got.)

### 3. Add the environment variables in Vercel

Vercel → your project → **Settings** → **Environment Variables**. Add both to
*Production*, *Preview* and *Development*:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the base64 string from step 2 |
| `ADMIN_EMAILS` | your email — comma-separated for several, e.g. `you@co.com,cto@co.com` |

Neither has a `VITE_` prefix, so neither reaches the browser.

### 4. Redeploy

Environment variables are baked in at build time, so an existing deployment
won't pick them up:

```bash
vercel --prod
```

Or push to your main branch, or hit **Redeploy** in the Vercel dashboard.

### 5. Publish the Firestore rules

**Do not skip this one.** Your project is currently in test mode — the rules say
`allow read, write: if true`, which means any signed-in user can read and write
*every board in the system* straight from the browser console. Locking down the
admin panel while that's true accomplishes nothing.

```bash
npx firebase deploy --only firestore:rules
```

Or paste `firestore.rules` into Firebase console → **Firestore Database** →
**Rules** → **Publish**.

**Verify before you rely on them.** In the console's Rules tab, open **Rules
Playground** and check at least these:

| Simulate | Expect |
|---|---|
| `get` on `/boards/{a board you own}`, authenticated as you | **Allow** |
| `get` on `/boards/{someone else's private board}`, authenticated as you | **Deny** |
| `get` on `/boards/{a public board}`, unauthenticated | **Allow** |
| `get` on `/_adminAudit/{anything}`, authenticated as you | **Deny** |
| `list` on `/people` (legacy root), authenticated | **Deny** |

Then open the app normally and confirm your boards still load. If a board
disappears, its `memberEmails` probably stores a differently-cased address than
the one you sign in with — fix it in the admin panel under **Boards → Inspect**.

### 6. Open the panel

Visit `https://<your-app>.vercel.app/admin` and sign in with your normal
account. If your email is in `ADMIN_EMAILS`, the panel opens. If not, you get a
polite refusal — and no data.

---

## What's in it

**Overview** — accounts, active users, boards, tasks; new accounts per week;
busiest boards.

**Users** — every Firebase Auth account, searchable by email, name or UID. Per
account: send a password reset link, set a password directly, rename, mark the
email verified, sign them out of every device, disable, or delete. Each row
shows how many boards they'd leave behind.

**Boards** — every board in the project, including ones you're not a member of.
Inspect people and tasks, rename, transfer ownership, add or remove members,
change public-link access, delete (with its subcollections).

**Directory** — the `orgMembers` suggestion directory and per-account
`userProfiles`. Fix names and photos, merge duplicate entries, and run the
backfill that scans every board for company-domain addresses.

**Audit log** — every change made through the panel: who, what, when. Written
server-side, and denied to all clients by the Firestore rules, so it can't be
forged or erased from the browser.

---

## Guard rails

- You can't disable or delete **your own** admin account, and you can't delete
  **any** account listed in `ADMIN_EMAILS` — remove them from the variable in
  Vercel first. Both paths would otherwise lock everyone out with no way back.
- Deleting a board or an account requires typing its exact name or email.
- Deleting a user **keeps** the boards they owned and tells you which ones are
  now unowned, so a departure doesn't quietly destroy a team's roadmap.
- Disabling someone also revokes their refresh tokens, so an open session on
  another device stops working immediately rather than at token expiry.

---

## Running it locally

`npm run dev` serves only the frontend — Vite has no serverless runtime, so
every `/api/admin/*` call returns the SPA's `index.html` and the panel will tell
you so. To run the functions locally:

```bash
npm i -g vercel
vercel dev
```

`vercel dev` pulls your environment variables down and serves both the app and
the functions on one port.

---

## Adding or removing an admin

Change `ADMIN_EMAILS` in Vercel and redeploy. There's deliberately no in-app way
to do it: a panel that can grant its own access is a panel that can be talked
into granting it.

---

## Security notes

- **`FIREBASE_SERVICE_ACCOUNT` is the keys to the kingdom.** If it ever leaks,
  revoke it in Firebase console → Service accounts → Manage service account
  keys, and generate a new one.
- **Rotate your GitHub token.** This repo's git remote currently has a personal
  access token embedded in the URL (`git remote -v` shows it). Anyone who sees
  that URL has push access. Revoke it at github.com → Settings → Developer
  settings → Personal access tokens, then:
  ```bash
  git remote set-url origin https://github.com/nandu-givelify/Design-roadmap.git
  ```
  and let the credential helper or an SSH key handle auth instead.
- **`/admin` is not secret and doesn't need to be.** It's `noindex`ed so it
  won't turn up in search results, but its security comes from the token check,
  not from the URL being hard to guess.
