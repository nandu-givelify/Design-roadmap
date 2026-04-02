# Design Roadmap — Setup & Deployment Guide

## What you have
A fully built React app with:
- Year / Quarter timeline views
- Drag-to-move and resize tasks
- Weekend shading, today line, jump-to-today
- Add tasks, people (with photo), and teams
- Filters by person and team
- View-only / edit share links
- Firebase Firestore for real-time cloud data

---

## Step 1 — Firebase setup (5 minutes)

1. Go to [firebase.google.com](https://firebase.google.com) → click **Get started**
2. Create a new project (name it anything, e.g. "design-roadmap")
3. Skip Google Analytics if asked
4. In the project dashboard → click **Firestore Database** in the left sidebar
5. Click **Create database** → choose **Start in test mode** → pick any region → click Enable
6. In the left sidebar → click the ⚙️ gear → **Project settings**
7. Scroll to **Your apps** → click **</>** (Web app) → register the app
8. Copy the `firebaseConfig` values shown

---

## Step 2 — Create your .env file

In the `design-roadmap` folder, create a file named `.env` with:

```
VITE_FIREBASE_API_KEY=paste_your_apiKey_here
VITE_FIREBASE_AUTH_DOMAIN=paste_your_authDomain_here
VITE_FIREBASE_PROJECT_ID=paste_your_projectId_here
VITE_FIREBASE_STORAGE_BUCKET=paste_your_storageBucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=paste_your_messagingSenderId_here
VITE_FIREBASE_APP_ID=paste_your_appId_here
```

---

## Step 3 — Deploy to Vercel (free, 2 minutes)

1. Go to [vercel.com](https://vercel.com) → sign up with GitHub
2. Click **Add New Project**
3. Upload or push this folder to a GitHub repo, then import it in Vercel
   - **Or** install the Vercel CLI: `npm i -g vercel` → run `vercel` from this folder
4. In Vercel project settings → **Environment Variables** → add all 6 `VITE_FIREBASE_*` variables
5. Click **Deploy** — you'll get a URL like `design-roadmap-xyz.vercel.app`

---

## Step 4 — Share the roadmap

Once deployed, open your app and click the **Share** button in the top-right:

- **View only link** — `yourapp.vercel.app?mode=view` — anyone can see, no edits
- **Full access link** — `yourapp.vercel.app?mode=edit` — anyone can add/edit tasks

---

## Local development

```bash
cd design-roadmap
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Firestore security (optional, when ready)

When you're done testing, go to Firebase → Firestore → **Rules** and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if true;  // change to restrict to your email later
    }
  }
}
```

For proper auth-based access, set up Firebase Authentication and update rules accordingly.
