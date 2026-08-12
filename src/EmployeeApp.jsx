import { useEffect, useMemo, useState } from "react";
import {
  MAX_GPS_ACCURACY_METERS,
  initializeStore,
  formatDateKey,
  formatTime,
  readConfig
} from "../attendance-data.js";

function detectDeviceType() {
  return matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop";
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Unknown";
}

export default function EmployeeApp() {
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const employee = useMemo(
    () => employees.find((item) => item.id === selectedEmployeeId) ?? employees[0],
    [employees, selectedEmployeeId]
  );

  useEffect(() => {
    Promise.all([initializeStore(), readConfig()])
      .then(([nextStore, config]) => {
        setStore(nextStore);
        setEmployees(config.employees);
        setSelectedEmployeeId(config.employees[0]?.id ?? "");
      })
      .catch((error) => {
        setStatus(error.message || "Unable to connect to the attendance server.");
        setStatusError(true);
      });
  }, []);

  useEffect(() => {
    if (!store || !employee) return;
    const date = formatDateKey(new Date());
    store
      .getAttendance(employee.id, date)
      .then((record) => {
        if (record) {
          setAttendance(record);
          setStatus("You have already checked in today.");
          setStatusError(false);
        }
      })
      .catch((error) => {
        setStatus(error.message);
        setStatusError(true);
      });
  }, [store, employee]);

  const handleSubmit = async () => {
    if (!store || !employee) {
      setStatus("App is not ready yet.");
      setStatusError(true);
      return;
    }

    setStatus("Checking today's attendance...");
    setStatusError(false);
    setIsLoading(true);

    try {
      const date = formatDateKey(new Date());
      const existing = await store.getAttendance(employee.id, date);
      if (existing) {
        setAttendance(existing);
        setStatus("You have already checked in today.");
        setIsLoading(false);
        return;
      }

      setStatus("Requesting location permission...");
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;

      if (accuracy > MAX_GPS_ACCURACY_METERS) {
        throw new Error("Current location is not accurate enough. Please retry.");
      }

      const now = new Date();
      const attendancePayload = {
        employeeId: employee.id,
        date,
        latitude,
        longitude,
        accuracyMeters: Math.round(accuracy),
        deviceType: detectDeviceType(),
        browser: detectBrowser()
      };

      const savedAttendance = await store.createAttendance(attendancePayload);
      setAttendance(savedAttendance);
      setStatus("Attendance saved.");
    } catch (error) {
      setStatus(error?.message || "Internal DB Error");
      setStatusError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-shell employee-shell">
      <header className="app-header">
        <div>
          <h1>Employee Attendance</h1>
          <p>{new Date().toLocaleDateString("en-IN", { weekday: "long" })}</p>
        </div>
      </header>

      <section className="employee-layout">
        <section className="attendance-panel" aria-labelledby="employee-title">
          <h2 id="employee-title">Check In</h2>
          <label htmlFor="employee-select">Employee</label>
          <select
            id="employee-select"
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            disabled={!employees.length}
          >
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <div className="welcome-block">
            <span>Welcome,</span>
            <strong>{employee?.name ?? "-"}</strong>
            <time dateTime={formatDateKey(new Date())}>
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              })}
            </time>
          </div>

          <button className="check-in-button" type="button" onClick={handleSubmit} disabled={isLoading || !employee}>
            {isLoading ? "CHECKING IN..." : "CHECK IN"}
          </button>
          <p className={`status-line ${statusError ? "is-error" : ""}`} role="status" aria-live="polite">
            {status}
          </p>
        </section>

        <section className="result-panel" aria-live="polite">
          {attendance ? (
            <>
              <div className={`success-mark ${attendance.status === "REMOTE" ? "is-warning" : ""}`}>
                {attendance.status === "REMOTE" ? "!" : "✓"}
              </div>
              <h2>{attendance.status === "REMOTE" ? "Check-In Recorded" : "Check-In Successful"}</h2>
              <dl className="result-list">
                <div>
                  <dt>Employee</dt>
                  <dd>{attendance.employeeName}</dd>
                </div>
                <div>
                  <dt>Check-in time</dt>
                  <dd>{formatTime(attendance.checkInTime)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{attendance.officeName}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{attendance.status}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="result-empty">
              <p>No check-in data yet. Use the form to record your attendance.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function getCurrentPosition() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}
