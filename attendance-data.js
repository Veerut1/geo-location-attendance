import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { firestoreDb, getFirebaseConfigError, hasFirebaseConfig } from "./src/firebase.js";

function assertFirebaseAvailable() {
  if (!hasFirebaseConfig || !firestoreDb) {
    throw new Error(getFirebaseConfigError() || "Firestore is not configured. Set the VITE_FIREBASE_* values in your .env file for your Firebase project.");
  }
}

const CONFIG_STORAGE_KEY = "attendance-config";

function emptyConfig() {
  return { employees: [], offices: [] };
}

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function readConfigFromStorage(storage = getStorage()) {
  if (!storage) {
    return emptyConfig();
  }

  try {
    const raw = storage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return emptyConfig();
    }

    const parsed = JSON.parse(raw);
    return {
      employees: Array.isArray(parsed?.employees) ? normalizeEmployees(parsed.employees) : [],
      offices: Array.isArray(parsed?.offices) ? parsed.offices.map(normalizeOffice) : []
    };
  } catch {
    return emptyConfig();
  }
}

export function writeConfigToStorage(config, storage = getStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
      employees: normalizeEmployees(config.employees),
      offices: normalizeOffices(config.offices)
    }));
    return true;
  } catch {
    return false;
  }
}

export const OFFICE_RADIUS_METERS = 200;
export const MAX_GPS_ACCURACY_METERS = 100;

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_ATTENDANCE_API_BASE || ""
    : "";
const ADMIN_LOGIN_ENDPOINT = `${API_BASE}/.netlify/functions/adminLogin`;
const ADMIN_LOGOUT_ENDPOINT = `${API_BASE}/.netlify/functions/adminLogout`;

export function createStore() {
  return createFirebaseStore();
}

export async function initializeStore() {
  return createFirebaseStore();
}

function createFirebaseStore() {
  return {
    async getAttendance(employeeId, date) {
      try {
        const normalizedEmployeeId = normalizeId(employeeId);
        const snapshot = await getDoc(doc(firestoreDb, "attendance", `${normalizedEmployeeId}_${date}`));
        return snapshot.exists() ? snapshot.data() : null;
      } catch (error) {
        throw new Error(parseFirebaseError(error, "Unable to load attendance."));
      }
    },

    async createAttendance(attendance) {
      try {
        const employeeId = normalizeId(attendance.employeeId);
        const { employees, offices } = await readConfig();
        const employee = employees.find((item) => item.id === employeeId);

        if (!employee) {
          throw new Error("Employee is not configured.");
        }

        const officeMatch = findNearestOffice(offices, attendance.latitude, attendance.longitude);
        const attendanceId = `${employeeId}_${attendance.date}`;
        const now = new Date();
        const attendanceData = {
          employeeId,
          employeeName: employee.name,
          date: attendance.date,
          checkInTime: now.toISOString(),
          latitude: attendance.latitude,
          longitude: attendance.longitude,
          accuracyMeters: Math.round(Number(attendance.accuracyMeters)),
          status: officeMatch.isOffice ? "OFFICE" : "REMOTE",
          officeId: officeMatch.office.id,
          officeName: officeMatch.office.name,
          distanceFromOfficeMeters: Math.round(officeMatch.distanceMeters),
          deviceType: String(attendance.deviceType || "unknown").slice(0, 40),
          browser: String(attendance.browser || "unknown").slice(0, 40),
          createdAt: now.toISOString()
        };

        const docRef = doc(firestoreDb, "attendance", attendanceId);
        const existing = await getDoc(docRef);
        if (existing.exists()) {
          throw new Error("You have already checked in today.");
        }

        await setDoc(docRef, attendanceData);
        return attendanceData;
      } catch (error) {
        if (error?.message === "Employee is not configured." || error?.message === "You have already checked in today.") {
          throw error;
        }
        throw new Error(parseFirebaseError(error, "Unable to save attendance."));
      }
    },

    async listAttendance() {
      try {
        const attendanceQuery = query(collection(firestoreDb, "attendance"), orderBy("checkInTime", "desc"));
        const snapshot = await getDocs(attendanceQuery);
        return snapshot.docs.map((attendanceDoc) => attendanceDoc.data());
      } catch (error) {
        throw new Error(parseFirebaseError(error, "Unable to load attendance records."));
      }
    }
  };
}

export async function readConfig() {
  try {
    assertFirebaseAvailable();
    const [employeesDoc, officesDoc] = await Promise.all([
      getDoc(doc(firestoreDb, "config", "employees")),
      getDoc(doc(firestoreDb, "config", "offices"))
    ]);

    return {
      employees: Array.isArray(employeesDoc.data()?.items) ? normalizeEmployees(employeesDoc.data().items) : [],
      offices: Array.isArray(officesDoc.data()?.items) ? officesDoc.data().items.map(normalizeOffice) : []
    };
  } catch (error) {
    throw new Error(parseFirebaseError(error, "Unable to load attendance configuration."));
  }
}

export async function saveConfig(config) {
  const employees = normalizeEmployees(config.employees);
  const offices = normalizeOffices(config.offices);

  if (!employees.length) {
    throw new Error("At least one employee is required.");
  }

  if (!offices.length) {
    throw new Error("At least one office is required.");
  }

  try {
    assertFirebaseAvailable();
    const updatedAt = new Date().toISOString();
    await Promise.all([
      setDoc(doc(firestoreDb, "config", "employees"), { items: employees, updatedAt }),
      setDoc(doc(firestoreDb, "config", "offices"), { items: offices, updatedAt })
    ]);
  } catch (error) {
    throw new Error(parseFirebaseError(error, "Unable to save attendance configuration."));
  }

  return {
    employees,
    offices
  };
}

export async function loginAdmin(passcode) {
  const response = await fetch(ADMIN_LOGIN_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode })
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function logoutAdmin() {
  await fetch(ADMIN_LOGOUT_ENDPOINT, {
    method: "POST",
    credentials: "include"
  });
}

async function parseApiError(response) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return body.error || body.message || response.statusText || text || "Server error";
  } catch {
    return response.statusText || text || "Server error";
  }
}

function parseFirebaseError(error, fallback) {
  if (error?.code === "permission-denied") {
    return "Firebase permission denied. Check Firestore security rules.";
  }

  return error?.message || fallback;
}

export function findNearestOffice(offices, latitude, longitude) {
  if (!offices.length) {
    return {
      office: {
        id: "",
        name: "No configured office",
        radiusMeters: OFFICE_RADIUS_METERS
      },
      distanceMeters: 0,
      isOffice: false
    };
  }

  const nearest = offices
    .map((office) => ({
      office,
      distanceMeters: distanceBetweenMeters(
        latitude,
        longitude,
        office.latitude,
        office.longitude
      )
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

  return {
    ...nearest,
    isOffice: nearest.distanceMeters <= OFFICE_RADIUS_METERS
  };
}

export function distanceBetweenMeters(latA, lonA, latB, lonB) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(value) {
  if (!value) {
    return "-";
  }

  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function normalizeOffice(office) {
  return {
    id: normalizeId(office.id),
    name: String(office.name ?? "").trim(),
    latitude: Number(office.latitude),
    longitude: Number(office.longitude),
    radiusMeters: OFFICE_RADIUS_METERS
  };
}

export function normalizeEmployees(employees = []) {
  return employees
    .map((employee) => ({
      id: normalizeId(employee.id),
      name: String(employee.name ?? "").trim()
    }))
    .filter((employee) => employee.id && employee.name);
}

export function normalizeOffices(offices = []) {
  return offices.map(normalizeOffice).filter(
    (office) =>
      office.id &&
      office.name &&
      isValidLatitude(office.latitude) &&
      isValidLongitude(office.longitude)
  );
}

export function normalizeId(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function formatCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
