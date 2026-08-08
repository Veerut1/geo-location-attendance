export const DEFAULT_EMPLOYEES = [
  { id: "EMP001", name: "Veeru" },
  { id: "EMP002", name: "Raj" },
  { id: "EMP003", name: "Akash" }
];

export const DEFAULT_OFFICES = [
  {
    id: "BLR001",
    name: "Bangalore Office",
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 200
  }
];

export const OFFICE_RADIUS_METERS = 200;
export const MAX_GPS_ACCURACY_METERS = 100;
export const STORAGE_KEY = "attendance-records";
export const EMPLOYEE_STORAGE_KEY = "attendance-employees";
export const OFFICE_STORAGE_KEY = "attendance-offices";

export function readEmployees() {
  return readConfig(EMPLOYEE_STORAGE_KEY, DEFAULT_EMPLOYEES);
}

export function saveEmployees(employees) {
  saveConfig(EMPLOYEE_STORAGE_KEY, employees);
}

export function readOffices() {
  return readConfig(OFFICE_STORAGE_KEY, DEFAULT_OFFICES).map(normalizeOffice);
}

export function saveOffices(offices) {
  saveConfig(OFFICE_STORAGE_KEY, offices.map(normalizeOffice));
}

export function createLocalStore() {
  return {
    async getAttendance(employeeId, date) {
      return readLocalRecords().find(
        (record) => record.employeeId === employeeId && record.date === date
      ) ?? null;
    },
    async createAttendance(attendance) {
      const records = readLocalRecords();
      const exists = records.some(
        (record) =>
          record.employeeId === attendance.employeeId && record.date === attendance.date
      );
      if (exists) {
        throw new Error("You have already checked in today.");
      }
      records.push(attendance);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return attendance;
    },
    async listAttendance() {
      return readLocalRecords();
    }
  };
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

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readLocalRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function readConfig(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(value) && value.length ? value : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function saveConfig(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
