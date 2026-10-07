# Sugar Coat Bakers — Customer Entry

Tablet-friendly web app for capturing customer details at the stall. **Works offline on iPad** — no laptop or internet needed on stall day (after one-time setup).

**Live app:** [sugar-coat-bakers.netlify.app](https://sugar-coat-bakers.netlify.app)  
**Source:** [github.com/ms-tech-geek/sugar-coat-bakers](https://github.com/ms-tech-geek/sugar-coat-bakers)

## Features

- Entry form: name, phone, amount (₹), optional notes
- Thank-you screen with Instagram QR code
- Saved entries: search, sort, edit, delete, pagination
- Export filtered list as CSV or PDF
- **Shared cloud storage (Firebase)** — 2 iPads stay in sync
- Duplicate phone number blocked across tablets
- Offline entry with sync when back online

---

## iPad-only setup (no laptop at stall)

The app must be **installed once at home** while the iPad has Wi‑Fi. After that, it runs from the Home Screen icon with no laptop and no internet.

### Step 1 — App is already hosted

The app is deployed at **[sugar-coat-bakers.netlify.app](https://sugar-coat-bakers.netlify.app)**.

Code lives on GitHub: **[ms-tech-geek/sugar-coat-bakers](https://github.com/ms-tech-geek/sugar-coat-bakers)**.

Push to `main` → Netlify auto-deploys.

**Firebase (2-iPad sync):** follow **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** once before stall day.

### Step 2 — Install on iPad (one time, at home)

1. Open the app URL in **Safari** on the iPad (not Chrome)
2. Wait for the page to load fully (~5 seconds)
3. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**
4. You should see a **Sugar Coat** icon on the home screen

### Step 3 — Test offline (before stall day)

1. Open the app from the **Home Screen icon** (not Safari tabs)
2. Save a test entry
3. Turn **Wi‑Fi off** (or enable Airplane Mode)
4. Open the app again from the Home Screen icon
5. Confirm you can still add entries, view saved list, and export CSV/PDF

### Stall day

- Open **Sugar Coat** from the Home Screen
- No laptop, no Wi‑Fi, no hotspot needed
- All entries stay on that iPad
- Export CSV/PDF anytime (share via AirDrop, email, or Files when you have signal again)

---

## Development on Mac (optional)

```bash
cd ~/Projects/sugar-coat-bakers
python3 -m http.server 8080
```

Open `http://localhost:8080` on your Mac, or `http://<mac-ip>:8080` on iPad (same Wi‑Fi) for testing.

---

## Important notes

- **Use Safari + Add to Home Screen.** Opening `index.html` from the Files app is unreliable.
- **Two iPads share one database** via Firebase when configured (see FIREBASE_SETUP.md).
- **Wi‑Fi or hotspot at stall** recommended so both tablets sync (offline entry still works, syncs later).
- **Admin PIN protects export & clear.** Tap the logo **5 times** → set or enter a 4-digit PIN → admin tools appear for 30 minutes. Customers only see the entry form.
- **Export before clearing.** Use CSV/PDF export to back up; “Clear all entries” is permanent.
- **Instagram QR** works offline (image is bundled in the app).
- **Do not clear Safari website data** for this app — that deletes saved entries.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | App UI |
| `app.js` | Logic, validation, export |
| `styles.css` | Brand styling |
| `manifest.json` | Home Screen app metadata |
| `service-worker.js` | Offline caching |
| `firebase-config.js` | Your Firebase project keys |
| `firebase-db.js` | Firestore sync layer |
| `firestore.rules` | Copy into Firebase Console |
| `FIREBASE_SETUP.md` | Step-by-step Firebase setup |
| `assets/instagram-qr.png` | Instagram follow QR |
| `assets/vendor/` | Firebase + PDF libraries (offline) |
