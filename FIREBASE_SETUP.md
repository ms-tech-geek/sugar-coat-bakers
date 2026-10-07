# Firebase setup — shared storage for 2 iPads

Follow these steps **once** on your Mac. After that, both iPads sync entries through Firebase.

---

## Step 1 — Create Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name: `sugar-coat-bakers` (or any name)
4. Disable Google Analytics if you don't need it → **Create project**

---

## Step 2 — Create Firestore database

1. In the left menu: **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll paste rules next)
4. Location: pick closest to India (e.g. `asia-south1` Mumbai) → **Enable**

---

## Step 3 — Security rules

1. Firestore → **Rules** tab
2. Replace everything with the contents of `firestore.rules` in this project:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customers/{customerId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

---

## Step 4 — Enable Anonymous sign-in

1. Left menu: **Build → Authentication**
2. Click **Get started**
3. **Sign-in method** tab → **Anonymous** → **Enable** → **Save**

Each iPad signs in anonymously automatically. Both can read/write the same `customers` collection.

---

## Step 5 — Register web app & copy config

1. Project **Overview** (gear icon) → **Project settings**
2. Scroll to **Your apps** → click **Web** (`</>`)
3. App nickname: `Sugar Coat Stall` → **Register app**
4. Copy the `firebaseConfig` object values

---

## Step 6 — Paste config into the project

1. Open `firebase-config.js` in this folder
2. Replace the placeholder values with your real config:

```javascript
const FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
};
```

3. Save the file

---

## Step 7 — Deploy to Netlify

```bash
cd ~/Projects/sugar-coat-bakers
git add firebase-config.js
git commit -m "Add Firebase config"
git push origin main
```

Netlify auto-deploys in ~30 seconds.

---

## Step 8 — Test on 2 iPads

1. Open [sugar-coat-bakers.netlify.app](https://sugar-coat-bakers.netlify.app) on **both** iPads (Safari)
2. Add to Home Screen on each (if not already)
3. Bottom status should say **Synced — shared across iPads**
4. Save an entry on iPad A → open saved entries on iPad B (logo ×5 → PIN) → entry appears
5. Try same phone on iPad B → should show **already registered** warning

---

## How sync works

| Feature | Behaviour |
|---------|-----------|
| **Online** | Entries sync instantly between iPads |
| **Offline** | Entry saves locally, syncs when Wi‑Fi returns |
| **Duplicate phone** | Blocked across both tablets |
| **Admin PIN** | Still on each iPad (export/clear) |
| **Old localStorage data** | Migrated to Firestore once on first connect |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Setup required — add Firebase config" | Fill in `firebase-config.js` and push |
| "Cloud sync failed" | Enable Anonymous Auth + publish Firestore rules |
| Permission denied | Rules not published, or Anonymous Auth off |
| Entries not appearing on other iPad | Check Wi‑Fi; wait a few seconds; pull to refresh by closing/reopening admin |

---

## Free tier limits (you won't hit these)

- 20,000 writes/day
- 50,000 reads/day
- 1 GB storage

A busy stall day uses ~500 writes and ~2,000 reads.
