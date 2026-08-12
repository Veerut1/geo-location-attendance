import fs from "fs";
import path from "path";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        const value = rest.join("=").trim();
        return [key, value.replace(/^['\"]|['\"]$/g, "")];
      })
  );
}

const projectRoot = process.cwd();
const dotenvVars = loadDotEnv(path.join(projectRoot, ".env"));
const env = { ...dotenvVars, ...process.env };
const configJson = env.ATTENDANCE_FIREBASE_CONFIG_JSON;
let firebaseConfig = null;

if (configJson) {
  try {
    firebaseConfig = JSON.parse(configJson);
  } catch (error) {
    console.error("Invalid ATTENDANCE_FIREBASE_CONFIG_JSON:", error.message);
    process.exit(1);
  }
} else if (env.ATTENDANCE_FIREBASE_API_KEY) {
  firebaseConfig = {
    apiKey: env.ATTENDANCE_FIREBASE_API_KEY,
    authDomain: env.ATTENDANCE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.ATTENDANCE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.ATTENDANCE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.ATTENDANCE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.ATTENDANCE_FIREBASE_APP_ID || ""
  };
}

const adminPasscode = env.ATTENDANCE_ADMIN_PASSCODE || null;
const useFirestore = env.ATTENDANCE_USE_FIRESTORE === "false" ? false : true;
const output = `window.ATTENDANCE_USE_FIRESTORE = ${useFirestore};\n\nwindow.ATTENDANCE_FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig, null, 2)};\n\nwindow.ATTENDANCE_ADMIN_PASSCODE = ${JSON.stringify(adminPasscode)};\n`;

const filePath = path.join(projectRoot, "firebase-config.js");
fs.writeFileSync(filePath, output, "utf8");
console.log(`Wrote firebase-config.js (useFirestore=${useFirestore})`);
