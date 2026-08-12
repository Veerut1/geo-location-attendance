import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { readConfigFromStorage, writeConfigToStorage } from "../attendance-data.js";

const read = (file) => readFileSync(file, "utf8");

test("browser code initializes Firebase with the modular Web SDK", () => {
  const browserSources = [
    "src/App.jsx",
    "src/EmployeeApp.jsx",
    "src/AdminApp.jsx",
    "src/main.jsx",
    "src/firebase.js",
    "attendance-data.js",
    "index.html"
  ].map(read).join("\n");

  assert.match(read("src/firebase.js"), /firebase\/app/);
  assert.match(read("src/firebase.js"), /initializeApp/);
  assert.match(read("attendance-data.js"), /firebase\/firestore/);
  assert.equal(browserSources.includes("VITE_ATTENDANCE_ADMIN_PASSCODE"), false);
});

test("app data access uses the Firebase Web SDK only", () => {
  const packageJson = JSON.parse(read("package.json"));
  const frontendData = read("attendance-data.js");

  assert.match(packageJson.dependencies.firebase, /^\^12\./);
  assert.equal(packageJson.dependencies["firebase-admin"], undefined);
  assert.doesNotMatch(frontendData, /\.netlify\/functions\/config/);
  assert.doesNotMatch(frontendData, /\.netlify\/functions\/listAttendance/);
  assert.doesNotMatch(frontendData, /\.netlify\/functions\/attendance/);
  assert.doesNotMatch(frontendData, /\.netlify\/functions\/getAttendance/);
  assert.match(frontendData, /setDoc\(doc\(firestoreDb, "config", "employees"\)/);
  assert.match(frontendData, /query\(collection\(firestoreDb, "attendance"\), orderBy/);
});

test("admin login keeps the passcode out of the browser bundle", () => {
  const adminLogin = read("netlify/functions/adminLogin.js");
  const adminAuth = read("netlify/functions/lib/adminAuth.js");

  assert.match(adminLogin, /process\.env\.ATTENDANCE_ADMIN_PASSCODE/);
  assert.match(adminAuth, /HttpOnly/);
  assert.match(adminAuth, /SameSite=Lax/);
});

test("Firestore client access is scoped to employee check-in reads and creates", () => {
  const rules = read("firestore.rules");

  assert.match(rules, /match \/config\/\{document\}/);
  assert.match(rules, /allow get: if document in \['employees', 'offices'\]/);
  assert.match(rules, /allow create, update/);
  assert.match(rules, /match \/attendance\/\{attendanceId\}/);
  assert.match(rules, /allow create: if isValidAttendance/);
  assert.match(rules, /allow list: if true/);
  assert.match(rules, /allow update, delete: if false/);
});

test("office matching keeps a fixed 200 meter radius", () => {
  const frontendData = read("attendance-data.js");

  assert.match(frontendData, /OFFICE_RADIUS_METERS = 200/);
});

test("app does not ship default employees or offices", () => {
  const appSources = [
    "attendance-data.js",
    "src/EmployeeApp.jsx",
    "src/AdminApp.jsx"
  ].map(read).join("\n");

  assert.doesNotMatch(appSources, /DEFAULT_EMPLOYEES|DEFAULT_OFFICES/);
  assert.doesNotMatch(appSources, /Veeru|Raj|Akash|Bangalore Office|BLR001|12\.9716|77\.5946/);
  assert.deepEqual(readConfigFromStorage(null), { employees: [], offices: [] });
});

test("weekly downloads use week-wise WFO WFH leave sheets", () => {
  const adminApp = read("src/AdminApp.jsx");

  assert.match(adminApp, /downloadWeekWiseWorkbook/);
  assert.match(adminApp, /buildWeekWiseWorkbook/);
  assert.match(adminApp, /record\.status === "OFFICE"[\s\S]*return "WFO"/);
  assert.match(adminApp, /record\.status === "REMOTE"[\s\S]*return "WFH"/);
  assert.match(adminApp, /return "L"/);
  assert.match(adminApp, /date\.getDay\(\) === 0 \|\| date\.getDay\(\) === 6/);
});

test("manual Netlify deployment workflow is available", () => {
  const workflow = read(".github/workflows/netlify-deploy.yml");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /netlify deploy/);
  assert.match(workflow, /NETLIFY_AUTH_TOKEN/);
  assert.match(workflow, /NETLIFY_SITE_ID/);
});

test("employee config can be persisted to browser storage", () => {
  const store = new Map();
  const storage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };

  const config = {
    employees: [{ id: "EMP001", name: "Ada" }],
    offices: [{ id: "OFF001", name: "HQ", latitude: 12.9716, longitude: 77.5946 }]
  };

  assert.equal(writeConfigToStorage(config, storage), true);
  assert.deepEqual(readConfigFromStorage(storage), {
    employees: [{ id: "EMP001", name: "Ada" }],
    offices: [{ id: "OFF001", name: "HQ", latitude: 12.9716, longitude: 77.5946, radiusMeters: 200 }]
  });
});
