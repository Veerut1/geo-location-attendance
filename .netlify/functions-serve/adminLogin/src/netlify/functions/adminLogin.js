var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
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

// netlify/functions/adminLogin.js
var adminLogin_exports = {};
__export(adminLogin_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(adminLogin_exports);

// netlify/functions/lib/adminAuth.js
var import_node_crypto = __toESM(require("crypto"), 1);
var COOKIE_NAME = "attendance_admin";
var SESSION_SECONDS = 60 * 60 * 8;
function getSigningSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ATTENDANCE_ADMIN_PASSCODE || "";
}
function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function sign(value) {
  return import_node_crypto.default.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}
function secureCookieFlag(event) {
  const host = event.headers.host || event.headers.Host || "";
  const proto = event.headers["x-forwarded-proto"] || event.headers["X-Forwarded-Proto"] || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || proto === "http" ? "" : "; Secure";
}
function createAdminCookie(event) {
  const payload = encode({ exp: Math.floor(Date.now() / 1e3) + SESSION_SECONDS });
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secureCookieFlag(event)}`;
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

// netlify/functions/adminLogin.js
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }
  try {
    const configuredPasscode = process.env.ATTENDANCE_ADMIN_PASSCODE || "";
    const { passcode } = readJson(event);
    if (!configuredPasscode) {
      return json(500, { error: "Admin passcode is not configured." });
    }
    if (String(passcode || "") !== configuredPasscode) {
      return json(401, { error: "Invalid passcode." });
    }
    return json(200, { success: true }, { "Set-Cookie": createAdminCookie(event) });
  } catch (error) {
    return serverError(error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=adminLogin.js.map
