import crypto from "node:crypto";

const COOKIE_NAME = "attendance_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function getSigningSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ATTENDANCE_ADMIN_PASSCODE || "";
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function secureCookieFlag(event) {
  const host = event.headers.host || event.headers.Host || "";
  const proto = event.headers["x-forwarded-proto"] || event.headers["X-Forwarded-Proto"] || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || proto === "http" ? "" : "; Secure";
}

export function createAdminCookie(event) {
  const payload = encode({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS });
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secureCookieFlag(event)}`;
}

export function clearAdminCookie(event) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieFlag(event)}`;
}

export function isAdminRequest(event) {
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
    return Number(decoded.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
