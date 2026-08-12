export function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

export function methodNotAllowed() {
  return json(405, { error: "Method not allowed." });
}

export function unauthorized() {
  return json(401, { error: "Admin login required." });
}

export function badRequest(message) {
  return json(400, { error: message });
}

export function serverError(error) {
  console.error(error);
  return json(500, { error: "Internal server error." });
}

export function readJson(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
