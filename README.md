# Geo Location Attendance

A simple React attendance app for Netlify. The browser app records employee location and manages attendance data with the Firebase Web SDK.

## Firebase Access Model

The React app initializes Firebase with the modular Web SDK and talks to Firestore directly:

- `config/employees` and `config/offices` are readable and writable by the browser.
- `attendance/{employeeId}_{date}` can be read by document id and created once by the browser.
- Attendance reports list the `attendance` collection directly from the browser.

The app does not ship with default employees or office locations. Add them from the admin screen or seed the Firestore `config` documents yourself.

Netlify Functions are only used for the lightweight admin passcode session:

- `adminLogin` and `adminLogout` manage the admin session cookie.

Firebase Web SDK config values are public browser configuration. This app does not use Firebase Admin credentials.

Important: because the data path is Web SDK-only and this app does not use Firebase Auth, Firestore security rules cannot verify the admin passcode cookie. Deploy rules that match your intended trust model before using this with real attendance data.

## Local Setup

```bash
npm install
npm run generate:env
npm run netlify:dev
```

Open the local Netlify URL shown in the terminal, usually `http://localhost:8888`.

## Environment Variables

Set these in `.env` for local Netlify Dev and in Netlify site settings for production:

```bash
ATTENDANCE_ADMIN_PASSCODE=change-this-passcode
ADMIN_SESSION_SECRET=change-this-long-random-secret
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

`VITE_ATTENDANCE_API_BASE` can stay empty when React and Netlify Functions are deployed on the same Netlify site.

## Routes

- `/` - employee check-in
- `/admin` - admin dashboard and CSV reports

## Build

```bash
npm run build
```

The production build is written to `build/`. Netlify reads `netlify.toml` and publishes that folder with functions from `netlify/functions`.

## Manual Netlify Deployment Workflow

This repo includes `.github/workflows/netlify-deploy.yml` with `workflow_dispatch`, so deployment can be triggered manually from GitHub Actions.

Add these GitHub repository secrets:

```bash
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
```

Then go to GitHub Actions, choose **Manual Netlify Deploy**, and run the workflow. Use the `production` input to choose draft or production deploy.

## Firestore Collections

- `attendance/{employeeId}_{date}` stores one check-in per employee per date.
- `config/employees` stores `{ items: [...] }`.
- `config/offices` stores `{ items: [...] }`.

Office check-ins within 200 meters of a configured office are marked `OFFICE`; otherwise they are marked `REMOTE`.
