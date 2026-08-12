var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/config.js
var config_exports = {};
__export(config_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(config_exports);

// netlify/functions/lib/adminAuth.js
var import_node_crypto = __toESM(require("crypto"), 1);
var COOKIE_NAME = "attendance_admin";
var SESSION_SECONDS = 60 * 60 * 8;
function getSigningSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ATTENDANCE_ADMIN_PASSCODE || "";
}
function sign(value) {
  return import_node_crypto.default.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}
function parseCookies(cookieHeader = "") {
  return Object.fromEntries(cookieHeader.split(";").map((cookie) => cookie.trim().split("=")).filter(([key, value]) => key && value));
}
function isAdminRequest(event) {
  const secret = getSigningSecret();
  if (!secret) {
    return false;
  }
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) {
    return false;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(decoded.exp) > Math.floor(Date.now() / 1e3);
  } catch {
    return false;
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
async function saveAttendanceConfig(db, config) {
  const employees = normalizeEmployees(config.employees);
  const offices = normalizeOffices(config.offices);
  if (!employees.length) {
    throw new Error("At least one employee is required.");
  }
  if (!offices.length) {
    throw new Error("At least one office is required.");
  }
  await Promise.all([
    db.collection("config").doc("employees").set({ items: employees, updatedAt: new Date() }),
    db.collection("config").doc("offices").set({ items: offices, updatedAt: new Date() })
  ]);
  return { employees, offices };
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
function unauthorized() {
  return json(401, { error: "Admin login required." });
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

// netlify/functions/config.js
var handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const db = getDb();
      return json(200, await getAttendanceConfig(db));
    }
    if (event.httpMethod === "PUT") {
      if (!isAdminRequest(event)) {
        return unauthorized();
      }
      try {
        const db = getDb();
        const config = await saveAttendanceConfig(db, readJson(event));
        return json(200, config);
      } catch (error) {
        return badRequest(error.message || "Invalid configuration.");
      }
    }
    return methodNotAllowed();
  } catch (error) {
    return serverError(error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=config.js.map
