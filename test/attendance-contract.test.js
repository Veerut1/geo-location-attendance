import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { readConfigFromStorage, writeConfigToStorage } from "../attendance-data.js";
import {
  buildDailyCsv,
  buildMonthlyWorkbook,
  buildWeekWiseWorkbook,
  createMonthlyReportHeaders,
  createMonthlyReportRows,
  createWeeklyReportRows,
  weekForDate
} from "../src/reportDownloads.js";

const read = (file) => readFileSync(file, "utf8");

test("browser code initializes Firebase with the modular Web SDK", () => {
  const browserSources = [
    "src/App.jsx",
    "src/EmployeeApp.jsx",
    "src/AdminApp.jsx",
    "src/reportDownloads.js",
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
  const reports = read("src/reportDownloads.js");
  const employees = [{ id: "EMP001", name: "Ada" }];
  const records = [
    { employeeId: "EMP001", date: "2026-08-25", status: "OFFICE" },
    { employeeId: "EMP001", date: "2026-09-01", status: "OFFICE" },
    { employeeId: "EMP001", date: "2026-09-02", status: "REMOTE" }
  ];
  const workbook = buildWeekWiseWorkbook(employees, records, [
    {
      label: "01 Sept 2026 - 03 Sept 2026",
      dates: [
        new Date(2026, 8, 1),
        new Date(2026, 8, 2),
        new Date(2026, 8, 3)
      ]
    }
  ]);
  const previousWeekRows = createWeeklyReportRows(employees, records, new Date(2026, 7, 26));

  assert.match(adminApp, /downloadWeeklyReport\(employees, records, reportDate\)/);
  assert.match(reports, /buildWeekWiseWorkbook/);
  assert.match(reports, /record\.status === "OFFICE"[\s\S]*return "WFO"/);
  assert.match(reports, /record\.status === "REMOTE"[\s\S]*return "WFH"/);
  assert.match(reports, /return "L"/);
  assert.match(reports, /date\.getDay\(\) === 0 \|\| date\.getDay\(\) === 6/);
  assert.match(workbook, /<Worksheet ss:Name="Week 1">/);
  assert.match(workbook, /<Style ss:ID="StatusWFO">[\s\S]*ss:Color="#C6EFCE"/);
  assert.match(workbook, /<Style ss:ID="StatusWFH">[\s\S]*ss:Color="#BDD7EE"/);
  assert.match(workbook, /<Style ss:ID="StatusLeave">[\s\S]*ss:Color="#FFF2CC"/);
  assert.match(workbook, /<Cell ss:StyleID="StatusWFO"><Data ss:Type="String">WFO<\/Data><\/Cell>/);
  assert.match(workbook, /<Cell ss:StyleID="StatusWFH"><Data ss:Type="String">WFH<\/Data><\/Cell>/);
  assert.match(workbook, /<Cell ss:StyleID="StatusLeave"><Data ss:Type="String">L<\/Data><\/Cell>/);
  assert.match(workbook, /<Data ss:Type="Number">1<\/Data>/);
  assert.deepEqual(previousWeekRows[0], ["Ada", 1, 0, 4]);
  assert.equal(weekForDate(new Date(2026, 7, 26)).key, "2026-08-24");
});

test("daily and monthly downloads generate their own selected-period report formats", () => {
  const adminApp = read("src/AdminApp.jsx");
  const employees = [{ id: "EMP001", name: "Ada, QA" }];
  const records = [
    {
      employeeId: "EMP001",
      employeeName: "Ada, QA",
      date: "2026-08-25",
      checkInTime: new Date(2026, 7, 25, 9, 45).toISOString(),
      status: "OFFICE",
      officeName: "HQ",
      distanceFromOfficeMeters: 22
    },
    {
      employeeId: "EMP001",
      employeeName: "Ada, QA",
      date: "2026-09-01",
      checkInTime: new Date(2026, 8, 1, 9, 15).toISOString(),
      status: "OFFICE",
      officeName: "HQ",
      distanceFromOfficeMeters: 12
    },
    {
      employeeId: "EMP001",
      employeeName: "Ada, QA",
      date: "2026-09-02",
      checkInTime: new Date(2026, 8, 2, 10, 15).toISOString(),
      status: "REMOTE",
      officeName: "Home",
      distanceFromOfficeMeters: 980
    }
  ];

  const dailyCsv = buildDailyCsv(records, new Date(2026, 8, 1));
  const monthlyWorkbook = buildMonthlyWorkbook(
    employees,
    records,
    new Date(2026, 8, 16),
    new Date(2026, 8, 16)
  );
  const monthlyRows = createMonthlyReportRows(
    employees,
    records,
    new Date(2026, 8, 16),
    new Date(2026, 8, 16)
  );
  const previousMonthlyRows = createMonthlyReportRows(
    employees,
    records,
    new Date(2026, 7, 12),
    new Date(2026, 8, 16)
  );
  const monthlyHeaders = createMonthlyReportHeaders(
    new Date(2026, 8, 16),
    new Date(2026, 8, 16)
  );
  const weeklyRows = createWeeklyReportRows(employees, records, new Date(2026, 8, 2));

  assert.match(adminApp, /downloadDailyReport\(records, reportDate\)/);
  assert.match(adminApp, /downloadMonthlyReport\(employees, records, reportDate\)/);
  assert.match(adminApp, /type=\{reportInputType\(activeReport\)\}/);
  assert.match(adminApp, /shiftReportDate\(activeReport, current, -1\)/);
  assert.match(dailyCsv, /^Employee,Date,Check-In Time,Status,Office,Distance From Office/m);
  assert.match(dailyCsv, /"Ada, QA",2026-09-01/);
  assert.doesNotMatch(dailyCsv, /2026-08-25/);
  assert.match(monthlyWorkbook, /<Worksheet ss:Name="Monthly Attendance">/);
  assert.doesNotMatch(monthlyWorkbook, /<Worksheet ss:Name="Week 1">/);
  assert.doesNotMatch(monthlyWorkbook, /Working Days|Late Check-Ins|Average Check-In Time/);
  assert.match(monthlyWorkbook, /<Data ss:Type="String">Tue, 01 Sept<\/Data>/);
  assert.match(monthlyWorkbook, /<Cell ss:StyleID="StatusWFO"><Data ss:Type="String">WFO<\/Data><\/Cell>/);
  assert.match(monthlyWorkbook, /<Cell ss:StyleID="StatusWFH"><Data ss:Type="String">WFH<\/Data><\/Cell>/);
  assert.match(monthlyWorkbook, /<Cell ss:StyleID="StatusLeave"><Data ss:Type="String">L<\/Data><\/Cell>/);
  assert.deepEqual(monthlyHeaders.slice(0, 4), ["Employee ID", "Employee", "Tue, 01 Sept", "Wed, 02 Sept"]);
  assert.deepEqual(monthlyHeaders.slice(-3), ["WFO", "WFH", "L"]);
  assert.deepEqual(monthlyRows[0].slice(0, 5), ["EMP001", "Ada, QA", "WFO", "WFH", "L"]);
  assert.deepEqual(monthlyRows[0].slice(-3), [1, 1, 10]);
  assert.deepEqual(previousMonthlyRows[0].slice(-3), [1, 0, 20]);
  assert.deepEqual(weeklyRows[0].slice(0, 4), ["Ada, QA", 1, 1, 3]);
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
