var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/attendance.js
var attendance_exports = {};
__export(attendance_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(attendance_exports);

// netlify/functions/lib/firebaseAdmin.js
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
function getDb() {
  if (!(0, import_app.getApps)().length) {
    const credentials = getFirebaseAdminCredentials();
    (0, import_app.initializeApp)({
      credential: (0, import_app.cert)(credentials)
    });
  }
  return (0, import_firestore.getFirestore)();
}
function getFirebaseAdminCredentials() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      return normalizeCredentials(JSON.parse(serviceAccountJson));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid Firebase service account JSON.");
    }
  }
  return normalizeCredentials({
    type: process.env.FIREBASE_TYPE || "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
    token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  });
}
function normalizeCredentials(credentials) {
  const privateKey = String(credentials.private_key || "").replace(/\\n/g, "\n");
  const normalized = __spreadProps(__spreadValues({}, credentials), {
    private_key: privateKey
  });
  const missing = [
    ["project_id", normalized.project_id],
    ["private_key", normalized.private_key],
    ["client_email", normalized.client_email]
  ].filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Firebase Admin credentials are missing: ${missing.join(", ")}. Set FIREBASE_SERVICE_ACCOUNT_JSON or the FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL env vars.`);
  }
  return normalized;
}

// netlify/functions/lib/http.js
function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: __spreadValues({
      "Content-Type": "application/json"
    }, headers),
    body: JSON.stringify(body)
  };
}
function methodNotAllowed() {
  return json(405, { error: "Method not allowed." });
}
function badRequest(message) {
  return json(400, { error: message });
}
function serverError(error) {
  console.error(error);
  return json(500, { error: "Internal server error." });
}
function readJson(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

// netlify/functions/lib/configStore.js
var DEFAULT_EMPLOYEES = [
  { id: "EMP001", name: "Veeru" },
  { id: "EMP002", name: "Raj" },
  { id: "EMP003", name: "Akash" }
];
var DEFAULT_OFFICES = [
  {
    id: "BLR001",
    name: "Bangalore Office",
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 200
  }
];
var OFFICE_RADIUS_METERS = 200;
async function getAttendanceConfig(db) {
  const [employeesDoc, officesDoc] = await Promise.all([
    db.collection("config").doc("employees").get(),
    db.collection("config").doc("offices").get()
  ]);
  return {
    employees: normalizeEmployees(employeesDoc.exists ? employeesDoc.data().items : DEFAULT_EMPLOYEES),
    offices: normalizeOffices(officesDoc.exists ? officesDoc.data().items : DEFAULT_OFFICES)
  };
}
function normalizeEmployees(employees = []) {
  return employees.map((employee) => ({
    id: normalizeId(employee.id),
    name: String(employee.name ?? "").trim()
  })).filter((employee) => employee.id && employee.name);
}
function normalizeOffices(offices = []) {
  return offices.map((office) => ({
    id: normalizeId(office.id),
    name: String(office.name ?? "").trim(),
    latitude: Number(office.latitude),
    longitude: Number(office.longitude),
    radiusMeters: OFFICE_RADIUS_METERS
  })).filter((office) => office.id && office.name && Number.isFinite(office.latitude) && office.latitude >= -90 && office.latitude <= 90 && Number.isFinite(office.longitude) && office.longitude >= -180 && office.longitude <= 180);
}
function normalizeId(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
function findNearestOffice(offices, latitude, longitude) {
  const nearest = offices.map((office) => ({
    office,
    distanceMeters: distanceBetweenMeters(latitude, longitude, office.latitude, office.longitude)
  })).sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  return __spreadProps(__spreadValues({}, nearest), {
    isOffice: nearest.distanceMeters <= OFFICE_RADIUS_METERS
  });
}
function distanceBetweenMeters(latA, lonA, latB, lonB) {
  const earthRadiusMeters = 6371e3;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

// netlify/functions/attendance.js
function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }
  try {
    const db = getDb();
    const body = readJson(event);
    const employeeId = normalizeId(body.employeeId);
    const date = String(body.date || "").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracyMeters = Math.round(Number(body.accuracyMeters));
    if (!employeeId || !date || !isValidCoordinate(latitude, longitude)) {
      return badRequest("Missing employee, date, or location.");
    }
    const { employees, offices } = await getAttendanceConfig(db);
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      return badRequest("Employee is not configured.");
    }
    const officeMatch = findNearestOffice(offices, latitude, longitude);
    const attendanceId = `${employeeId}_${date}`;
    const now = new Date();
    const attendanceData = {
      employeeId,
      employeeName: employee.name,
      date,
      checkInTime: now.toISOString(),
      latitude,
      longitude,
      accuracyMeters,
      status: officeMatch.isOffice ? "OFFICE" : "REMOTE",
      officeId: officeMatch.office.id,
      officeName: officeMatch.office.name,
      distanceFromOfficeMeters: Math.round(officeMatch.distanceMeters),
      deviceType: String(body.deviceType || "unknown").slice(0, 40),
      browser: String(body.browser || "unknown").slice(0, 40),
      createdAt: now.toISOString()
    };
    const docRef = db.collection("attendance").doc(attendanceId);
    const existing = await docRef.get();
    if (existing.exists) {
      return json(409, { error: "You have already checked in today." });
    }
    await docRef.set(attendanceData);
    return json(201, { success: true, attendance: attendanceData });
  } catch (error) {
    return serverError(error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=attendance.js.map
