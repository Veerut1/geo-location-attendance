import { createAdminCookie } from "./lib/adminAuth.js";
import { json, methodNotAllowed, readJson, serverError } from "./lib/http.js";

export const handler = async (event) => {
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
