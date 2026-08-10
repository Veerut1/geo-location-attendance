# Geo Location Attendance

A daily employee check-in app. Employees check in once per working day.

## Run

```bash
npm run dev
```

Open `http://localhost:5173`.

## Firebase Setup

1. Fill in `firebase-config.js` using `firebase-config.example.js` as a guide.
2. Keep `window.ATTENDANCE_USE_FIRESTORE = false` for local demos.
3. Deploy `firestore.rules` to enforce one check-in per employee per date.
4. Set `window.ATTENDANCE_USE_FIRESTORE = true` only after Firestore access is ready.

When `firebase-config.js` is not configured, the app falls back to local browser storage for demos.

### Environment-based config generation

If you use `.env`, `npm run dev` now generates `firebase-config.js` automatically before starting the app.

Create a `.env` file in the project root, then run:

```bash
npm run dev
```

or generate config explicitly with:

```bash
npm run generate-config
```

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that deploys the static app to GitHub Pages whenever code is merged to the `main` branch.

The workflow copies the app's static files into a temporary `public` folder and publishes them using `peaceiris/actions-gh-pages@v4`.

After merge, GitHub Pages will serve the site from the generated `gh-pages` branch.
## Admin Setup

Use the Admin view to maintain employee details, configure one or more office locations, and download attendance reports as CSV files.

Each office is matched with a fixed 200 meter radius. A check-in inside that radius is marked `OFFICE`; a check-in outside all configured office areas is marked `REMOTE`.

## Data Model

Attendance documents use:

```text
attendance/{employeeId}_{YYYY-MM-DD}
```

Allowed fields are limited to check-in data only:

```json
{
  "employeeId": "EMP001",
  "employeeName": "Veeru",
  "date": "2026-08-08",
  "checkInTime": "serverTimestamp",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "accuracyMeters": 15,
  "status": "OFFICE",
  "officeId": "BLR001",
  "officeName": "Bangalore Office",
  "distanceFromOfficeMeters": 23,
  "deviceType": "mobile",
  "browser": "Safari",
  "createdAt": "serverTimestamp"
}
```