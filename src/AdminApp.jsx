import { useEffect, useState } from "react";
import {
  initializeStore,
  formatCsvCell,
  formatDateKey,
  formatTime,
  isValidLatitude,
  isValidLongitude,
  loginAdmin,
  logoutAdmin,
  normalizeId,
  normalizeOffice,
  readConfig,
  saveConfig
} from "../attendance-data.js";

const ADMIN_SESSION_KEY = "attendance-admin-session";
const LATE_CHECK_IN_HOUR = 10;

export default function AdminApp() {
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [offices, setOffices] = useState([]);
  const [activeReport, setActiveReport] = useState("daily");
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
  }, [loginActive, activeReport, employees, offices, store]);

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
      const today = formatDateKey(new Date());
      const todayRecords = records.filter((record) => record.date === today);
      setReportHeaders(["Employee", "Date", "Check-In Time", "Status", "Office", "Distance From Office"]);
      setReportRows(
        todayRecords.map((record) => [
          record.employeeName,
          record.date,
          formatTime(record.checkInTime),
          record.status,
          record.officeName,
          `${record.distanceFromOfficeMeters} m`
        ])
      );
      return;
    }

    if (activeReport === "weekly") {
      const weekDates = datesInCurrentWeek();
      setReportHeaders(["Employee", "Office Days", "Remote Days", "Not Checked In"]);
      setReportRows(employees.map((employee) => summarizeEmployee(employee, records, weekDates)));
      return;
    }

    const monthDates = workingDatesInCurrentMonth();
    setReportHeaders([
      "Employee",
      "Working Days",
      "Office Days",
      "Remote Days",
      "Not Checked In",
      "Late Check-Ins",
      "Average Check-In Time"
    ]);
    setReportRows(employees.map((employee) => summarizeEmployeeMonth(employee, records, monthDates)));
  };

  const downloadReport = async () => {
    if (activeReport !== "daily") {
      if (!store) return;
      try {
        const records = await store.listAttendance();
        downloadWeekWiseWorkbook(employees, records);
      } catch (error) {
        setLoginStatus(error.message || "Unable to download attendance records.");
      }
      return;
    }

    const rows = [reportHeaders, ...reportRows];
    const csv = rows.map((row) => row.map(formatCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeReport}-attendance-${formatDateKey(new Date())}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

function downloadWeekWiseWorkbook(employees, records) {
  const weeks = weeksInCurrentMonthToDate();
  const workbook = buildWeekWiseWorkbook(employees, records, weeks);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `week-wise-attendance-${formatDateKey(new Date())}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildWeekWiseWorkbook(employees, records, weeks) {
  const worksheets = weeks.map((week, index) => {
    const headers = [
      "Employee ID",
      "Employee",
      ...week.dates.map((date) => formatWeekdayHeader(date)),
      "WFO",
      "WFH",
      "L"
    ];
    const rows = employees.map((employee) => buildWeekWiseEmployeeRow(employee, records, week.dates));

    return `
      <Worksheet ss:Name="${escapeXml(`Week ${index + 1}`)}">
        <Table>
          ${spreadsheetRow([week.label], "Header")}
          ${spreadsheetRow(headers, "Header")}
          ${rows.map((row) => spreadsheetRow(row)).join("")}
        </Table>
      </Worksheet>`;
  });

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
    </Style>
  </Styles>
  ${worksheets.join("")}
</Workbook>`;
}

function buildWeekWiseEmployeeRow(employee, records, dates) {
  const statuses = dates.map((date) => attendanceCodeForDate(employee, records, date));
  const wfoDays = statuses.filter((status) => status === "WFO").length;
  const wfhDays = statuses.filter((status) => status === "WFH").length;
  const leaveDays = statuses.filter((status) => status === "L").length;

  return [employee.id, employee.name, ...statuses, wfoDays, wfhDays, leaveDays];
}

function attendanceCodeForDate(employee, records, date) {
  const dateKey = formatDateKey(date);
  const record = records.find((item) => item.employeeId === employee.id && item.date === dateKey);

  if (!record) {
    return "L";
  }

  if (record.status === "OFFICE") {
    return "WFO";
  }

  if (record.status === "REMOTE") {
    return "WFH";
  }

  return "L";
}

function weeksInCurrentMonthToDate() {
  const today = startOfDay(new Date());
  const weeks = [];

  for (let day = 1; day <= today.getDate(); day += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    const weekStartKey = formatDateKey(startOfWeek(date));
    let week = weeks.find((item) => item.key === weekStartKey);
    if (!week) {
      week = { key: weekStartKey, dates: [] };
      weeks.push(week);
    }

    week.dates.push(date);
  }

  return weeks.map((week) => ({
    ...week,
    label: `${formatDateLabel(week.dates[0])} - ${formatDateLabel(week.dates[week.dates.length - 1])}`
  }));
}

function startOfWeek(date) {
  const next = startOfDay(date);
  const offset = next.getDay() === 0 ? -6 : 1 - next.getDay();
  next.setDate(next.getDate() + offset);
  return next;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatWeekdayHeader(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function formatDateLabel(date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function spreadsheetRow(values, styleId = "") {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Row>${values.map((value) => `<Cell${style}><Data ss:Type="${typeof value === "number" ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function summarizeEmployee(employee, records, dates) {
  const employeeRecords = records.filter(
    (record) => record.employeeId === employee.id && dates.includes(record.date)
  );
  const officeDays = employeeRecords.filter((record) => record.status === "OFFICE").length;
  const remoteDays = employeeRecords.filter((record) => record.status === "REMOTE").length;
  return [employee.name, officeDays, remoteDays, dates.length - employeeRecords.length];
}

function summarizeEmployeeMonth(employee, records, dates) {
  const employeeRecords = records.filter(
    (record) => record.employeeId === employee.id && dates.includes(record.date)
  );
  const officeDays = employeeRecords.filter((record) => record.status === "OFFICE").length;
  const remoteDays = employeeRecords.filter((record) => record.status === "REMOTE").length;
  const lateCheckIns = employeeRecords.filter(
    (record) => new Date(record.checkInTime).getHours() >= LATE_CHECK_IN_HOUR
  ).length;

  return [
    employee.name,
    dates.length,
    officeDays,
    remoteDays,
    dates.length - employeeRecords.length,
    lateCheckIns,
    averageCheckInTime(employeeRecords)
  ];
}

function averageCheckInTime(records) {
  if (!records.length) {
    return "-";
  }

  const totalMinutes = records.reduce((sum, record) => {
    const checkIn = new Date(record.checkInTime);
    return sum + checkIn.getHours() * 60 + checkIn.getMinutes();
  }, 0);
  const averageMinutes = Math.round(totalMinutes / records.length);
  const hours = Math.floor(averageMinutes / 60);
  const minutes = averageMinutes % 60;
  return formatTime(new Date(2000, 0, 1, hours, minutes).toISOString());
}

function datesInCurrentWeek() {
  const today = new Date();
  const monday = new Date(today);
  const offset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  monday.setDate(today.getDate() + offset);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatDateKey(date);
  });
}

function workingDatesInCurrentMonth() {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(formatDateKey(date));
    }
  }

  return dates;
}
