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

// netlify/functions/getAttendance.js
var getAttendance_exports = {};
__export(getAttendance_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(getAttendance_exports);

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
function badRequest(message) {
  return json(400, { error: message });
}
function serverError(error) {
  console.error(error);
  return json(500, { error: "Internal server error." });
}

// netlify/functions/lib/configStore.js
function normalizeId(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

// netlify/functions/getAttendance.js
var handler = async (event) => {
  try {
    const db = getDb();
    const { employeeId, date } = event.queryStringParameters || {};
    const normalizedEmployeeId = normalizeId(employeeId);
    if (!normalizedEmployeeId || !date) {
      return badRequest("Missing employeeId or date.");
    }
    const docRef = db.collection("attendance").doc(`${normalizedEmployeeId}_${date}`);
    const snapshot = await docRef.get();
    return json(200, { attendance: snapshot.exists ? snapshot.data() : null });
  } catch (error) {
    return serverError(error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=getAttendance.js.map
