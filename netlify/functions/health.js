import { json } from "./lib/http.js";

export const handler = async () => json(200, { status: "ok" });
