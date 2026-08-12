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

// netlify/functions/adminLogout.js
var adminLogout_exports = {};
__export(adminLogout_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(adminLogout_exports);

// netlify/functions/lib/adminAuth.js
var import_node_crypto = __toESM(require("crypto"), 1);
var COOKIE_NAME = "attendance_admin";
var SESSION_SECONDS = 60 * 60 * 8;
function secureCookieFlag(event) {
  const host = event.headers.host || event.headers.Host || "";
  const proto = event.headers["x-forwarded-proto"] || event.headers["X-Forwarded-Proto"] || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || proto === "http" ? "" : "; Secure";
}
function clearAdminCookie(event) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieFlag(event)}`;
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

// netlify/functions/adminLogout.js
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }
  return json(200, { success: true }, { "Set-Cookie": clearAdminCookie(event) });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=adminLogout.js.map
