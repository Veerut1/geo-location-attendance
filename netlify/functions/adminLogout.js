import { clearAdminCookie } from "./lib/adminAuth.js";
import { json, methodNotAllowed } from "./lib/http.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  return json(200, { success: true }, { "Set-Cookie": clearAdminCookie(event) });
};
