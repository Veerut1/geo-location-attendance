import { useEffect, useState } from "react";
import {
  formatDateKey,
  initializeStore,
  isValidLatitude,
  isValidLongitude,
  loginAdmin,
  logoutAdmin,
  normalizeId,
  normalizeOffice,
  readConfig,
  saveConfig
} from "../attendance-data.js";
import {
  DAILY_REPORT_HEADERS,
  WEEKLY_REPORT_HEADERS,
  createDailyReportRows,
  createMonthlyReportHeaders,
  createMonthlyReportRows,
  createWeeklyReportRows,
  downloadDailyReport,
  downloadMonthlyReport,
  downloadWeeklyReport,
  formatMonthKey,
  weekForDate
} from "./reportDownloads.js";

const ADMIN_SESSION_KEY = "attendance-admin-session";

export default function AdminApp() {
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [offices, setOffices] = useState([]);
  const [activeReport, setActiveReport] = useState("daily");
  const [reportDate, setReportDate] = useState(() => new Date());
  const [loginActive, setLoginActive] = useState(sessionStorage.getItem(ADMIN_SESSION_KEY) === "active");
  const [loginStatus, setLoginStatus] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [reportRows, setReportRows] = useState([]);
  const [reportHeaders, setReportHeaders] = useState([]);

  useEffect(() => {
    Promise.all([initializeStore(), readConfig()])
      .then(([nextStore, config]) => {
        setStore(nextStore);
        setEmployees(config.employees);
        setOffices(config.offices);
      })
      .catch((error) => {
        setLoginStatus(error.message || "Unable to connect to the attendance server.");
      });
  }, []);

  useEffect(() => {
    if (!loginActive) return;
    generateReport();
  }, [loginActive, activeReport, reportDate, employees, offices, store]);

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      await loginAdmin(event.target.password.value);
      sessionStorage.setItem(ADMIN_SESSION_KEY, "active");
      setLoginActive(true);
      setLoginStatus("");
      await generateReport();
    } catch (error) {
      setLoginStatus(error.message || "Invalid passcode.");
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setLoginActive(false);
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    const id = normalizeId(employeeId);
    const name = employeeName.trim();
    if (!id || !name) return;

    const next = [...employees];
    const index = next.findIndex((item) => item.id === id);
    if (index >= 0) next[index] = { id, name };
    else next.push({ id, name });

    const config = await saveConfig({ employees: next, offices });
    setEmployees(config.employees);
    setOffices(config.offices);
    setEmployeeId("");
    setEmployeeName("");
  };

  const saveOffice = async (event) => {
    event.preventDefault();
    const id = normalizeId(officeId);
    const name = officeName.trim();
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!id || !name || !isValidLatitude(lat) || !isValidLongitude(lon)) {
      setLoginStatus("Enter a valid office name, latitude, and longitude.");
      return;
    }

    const next = [...offices];
    const index = next.findIndex((item) => item.id === id);
    const office = normalizeOffice({ id, name, latitude: lat, longitude: lon });
    if (index >= 0) next[index] = office;
    else next.push(office);

    const config = await saveConfig({ employees, offices: next });
    setEmployees(config.employees);
    setOffices(config.offices);
    setOfficeId("");
    setOfficeName("");
    setLatitude("");
    setLongitude("");
  };

  const removeEmployee = async (id) => {
    const next = employees.filter((item) => item.id !== id);
    const config = await saveConfig({ employees: next, offices });
    setEmployees(config.employees);
    setOffices(config.offices);
  };

  const removeOffice = async (id) => {
    const next = offices.filter((item) => item.id !== id);
    const config = await saveConfig({ employees, offices: next });
    setEmployees(config.employees);
    setOffices(config.offices);
  };

  const generateReport = async () => {
    if (!store) return;
    let records = [];
    try {
      records = await store.listAttendance();
    } catch (error) {
      setLoginStatus(error.message || "Unable to load attendance records.");
      return;
    }
    if (activeReport === "daily") {
      setReportHeaders(DAILY_REPORT_HEADERS);
      setReportRows(createDailyReportRows(records, reportDate));
      return;
    }

    if (activeReport === "weekly") {
      setReportHeaders(WEEKLY_REPORT_HEADERS);
      setReportRows(createWeeklyReportRows(employees, records, reportDate));
      return;
    }

    setReportHeaders(createMonthlyReportHeaders(reportDate));
    setReportRows(createMonthlyReportRows(employees, records, reportDate));
  };

  const downloadReport = async () => {
    if (!store) return;

    try {
      const records = await store.listAttendance();
      if (activeReport === "daily") {
        downloadDailyReport(records, reportDate);
      } else if (activeReport === "weekly") {
        downloadWeeklyReport(employees, records, reportDate);
      } else {
        downloadMonthlyReport(employees, records, reportDate);
      }
      setLoginStatus("");
    } catch (error) {
      setLoginStatus(error.message || "Unable to download attendance records.");
      return;
    }
  };

  if (!loginActive) {
    return (
      <main className="app-shell">
        <section className="login-panel" aria-labelledby="admin-login-title">
          <h1 id="admin-login-title">Admin Login</h1>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Passcode
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Sign In</button>
          </form>
          <p className={`status-line ${loginStatus ? "is-error" : ""}`} role="status" aria-live="polite">
            {loginStatus}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="admin-dashboard">
        <header className="app-header">
          <div>
            <h1>Attendance Admin</h1>
            <p>{new Date().toLocaleDateString("en-IN", { weekday: "long" })}</p>
          </div>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            Sign Out
          </button>
        </header>

        <section className="admin-grid">
          <section className="admin-card" aria-labelledby="employee-admin-title">
            <div className="section-header">
              <h2 id="employee-admin-title">Employee Details</h2>
            </div>
            <form className="config-form" onSubmit={saveEmployee}>
              <label>
                Employee ID
                <input value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="EMP004" required />
              </label>
              <label>
                Name
                <input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee name" required />
              </label>
              <button type="submit">Save Employee</button>
            </form>
            <div className="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.id}</td>
                      <td>{employee.name}</td>
                      <td>
                        <button type="button" className="row-button" onClick={() => removeEmployee(employee.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card" aria-labelledby="office-admin-title">
            <div className="section-header">
              <h2 id="office-admin-title">Office Locations</h2>
              <span className="radius-note">200 m radius</span>
            </div>
            <form className="config-form" onSubmit={saveOffice}>
              <label>
                Office ID
                <input value={officeId} onChange={(event) => setOfficeId(event.target.value)} placeholder="Office ID" required />
              </label>
              <label>
                Office Name
                <input value={officeName} onChange={(event) => setOfficeName(event.target.value)} placeholder="Office name" required />
              </label>
              <label>
                Latitude
                <input value={latitude} onChange={(event) => setLatitude(event.target.value)} type="number" step="0.000001" placeholder="Latitude" required />
              </label>
              <label>
                Longitude
                <input value={longitude} onChange={(event) => setLongitude(event.target.value)} type="number" step="0.000001" placeholder="Longitude" required />
              </label>
              <button type="submit">Save Office</button>
            </form>
            <div className="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Office ID</th>
                    <th>Name</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Radius</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offices.map((office) => (
                    <tr key={office.id}>
                      <td>{office.id}</td>
                      <td>{office.name}</td>
                      <td>{office.latitude.toFixed(6)}</td>
                      <td>{office.longitude.toFixed(6)}</td>
                      <td>{office.radiusMeters} m</td>
                      <td>
                        <button type="button" className="row-button" onClick={() => removeOffice(office.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card reports-card" aria-labelledby="reports-title">
            <div className="section-header">
              <h2 id="reports-title">Reports</h2>
              <div className="report-actions">
                <div className="tabs" role="tablist" aria-label="Attendance reports">
                  {[
                    { id: "daily", label: "Daily" },
                    { id: "weekly", label: "Weekly" },
                    { id: "monthly", label: "Monthly" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      className={`tab ${activeReport === tab.id ? "is-active" : ""}`}
                      type="button"
                      onClick={() => setActiveReport(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="period-controls" aria-label="Report period">
                  <button
                    className="period-button"
                    type="button"
                    onClick={() => setReportDate((current) => shiftReportDate(activeReport, current, -1))}
                  >
                    Prev
                  </button>
                  <input
                    aria-label={`${activeReport} report period`}
                    type={reportInputType(activeReport)}
                    value={reportInputValue(activeReport, reportDate)}
                    max={reportInputValue(activeReport, new Date())}
                    onChange={(event) => setReportDate(parseReportInputValue(activeReport, event.target.value, reportDate))}
                  />
                  <span className="period-label">{reportPeriodLabel(activeReport, reportDate)}</span>
                  <button
                    className="period-button"
                    type="button"
                    onClick={() => setReportDate((current) => shiftReportDate(activeReport, current, 1))}
                    disabled={isCurrentReportPeriod(activeReport, reportDate)}
                  >
                    Next
                  </button>
                </div>
                <button className="secondary-button" type="button" onClick={downloadReport}>
                  {activeReport === "daily" ? "Download CSV" : "Download XLS"}
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{reportHeaders.map((header) => <th key={header}>{header}</th>)}</tr>
                </thead>
                <tbody>
                  {reportRows.length > 0 ? (
                    reportRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={reportHeaders.length}>No attendance records yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function shiftReportDate(activeReport, date, amount) {
  if (activeReport === "daily") {
    const next = new Date(date);
    next.setDate(date.getDate() + amount);
    return next;
  }

  if (activeReport === "weekly") {
    const next = new Date(date);
    next.setDate(date.getDate() + amount * 7);
    return next;
  }

  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function reportInputType(activeReport) {
  if (activeReport === "weekly") {
    return "week";
  }

  if (activeReport === "monthly") {
    return "month";
  }

  return "date";
}

function reportInputValue(activeReport, date) {
  if (activeReport === "weekly") {
    return isoWeekInputValue(date);
  }

  if (activeReport === "monthly") {
    return formatMonthKey(date);
  }

  return formatDateKey(date);
}

function parseReportInputValue(activeReport, value, fallbackDate) {
  if (!value) {
    return fallbackDate;
  }

  if (activeReport === "weekly") {
    return parseIsoWeekInputValue(value) ?? fallbackDate;
  }

  if (activeReport === "monthly") {
    const [year, month] = value.split("-").map(Number);
    if (Number.isInteger(year) && Number.isInteger(month)) {
      return new Date(year, month - 1, 1);
    }
    return fallbackDate;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
    return new Date(year, month - 1, day);
  }

  return fallbackDate;
}

function reportPeriodLabel(activeReport, date) {
  if (activeReport === "weekly") {
    return weekForDate(date).label;
  }

  if (activeReport === "monthly") {
    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isCurrentReportPeriod(activeReport, date) {
  const today = new Date();

  if (activeReport === "weekly") {
    return weekForDate(date).key >= weekForDate(today).key;
  }

  if (activeReport === "monthly") {
    return formatMonthKey(date) >= formatMonthKey(today);
  }

  return formatDateKey(date) >= formatDateKey(today);
}

function isoWeekInputValue(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNumber + 3);
  const weekNumber = 1 + Math.round((target - firstThursday) / 604800000);
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function parseIsoWeekInputValue(value) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  const fourthOfJanuary = new Date(year, 0, 4);
  const dayNumber = (fourthOfJanuary.getDay() + 6) % 7;
  const monday = new Date(fourthOfJanuary);
  monday.setDate(fourthOfJanuary.getDate() - dayNumber + (week - 1) * 7);
  return monday;
}
