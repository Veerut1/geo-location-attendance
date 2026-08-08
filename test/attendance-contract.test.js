import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const sourceFiles = [
  "app.js",
  "firestore.rules",
  "index.html",
  "README.md"
];

test("attendance source keeps the product check-in only", () => {
  const forbiddenTerms = [
    "check" + "Out",
    "check-" + "out",
    "check" + "out",
    "working" + "Minutes",
    "working" + "Hours",
    "total" + "Hours"
  ];

  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8").toLowerCase();
    for (const term of forbiddenTerms) {
      assert.equal(source.includes(term.toLowerCase()), false, `${file} contains ${term}`);
    }
  }
});

test("firestore rules enforce create-only attendance records", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /allow create: if !exists/);
  assert.match(rules, /allow update, delete: if false/);
  assert.match(rules, /attendanceId == request\.resource\.data\.employeeId \+ "_" \+ request\.resource\.data\.date/);
});

test("admin configuration and report download controls are available", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /data-view="admin"/);
  assert.match(html, /id="employee-config-form"/);
  assert.match(html, /id="office-config-form"/);
  assert.match(html, /id="download-report-button"/);
});

test("office matching uses a fixed 200 meter radius", () => {
  const source = readFileSync("app.js", "utf8");
  assert.match(source, /const OFFICE_RADIUS_METERS = 200;/);
  assert.match(source, /nearest\.distanceMeters <= OFFICE_RADIUS_METERS/);
});

test("storage provider wording is not visible in the page", () => {
  const html = readFileSync("index.html", "utf8");
  assert.equal(html.includes("storage-mode"), false);
  assert.equal(html.includes("mode-chip"), false);
  assert.equal(html.includes("Fire" + "store"), false);
});
