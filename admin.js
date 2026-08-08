import {
  OFFICE_RADIUS_METERS,
  createLocalStore,
  escapeHtml,
  formatCsvCell,
  formatDateKey,
  formatTime,
  isValidLatitude,
  isValidLongitude,
  normalizeId,
  normalizeOffice,
  readEmployees,
  readOffices,
  saveEmployees,
  saveOffices
} from "./attendance-data.js";

const LATE_CHECK_IN_HOUR = 10;
const ADMIN_SESSION_KEY = "attendance-admin-session";
const DEFAULT_ADMIN_PASSCODE = "admin123";

const els = {
  loginPanel: document.querySelector("#admin-login-panel"),
  dashboard: document.querySelector("#admin-dashboard"),
  loginForm: document.querySelector("#admin-login-form"),
  passwordInput: document.querySelector("#admin-password-input"),
  loginStatus: document.querySelector("#admin-login-status"),
  logoutButton: document.querySelector("#admin-logout-button"),
  currentDay: document.querySelector("#admin-current-day"),
  employeeConfigForm: document.querySelector("#employee-config-form"),
  employeeIdInput: document.querySelector("#employee-id-input"),
  employeeNameInput: document.querySelector("#employee-name-input"),
  employeeTable: document.querySelector("#employee-table"),
  officeConfigForm: document.querySelector("#office-config-form"),
  officeIdInput: document.querySelector("#office-id-input"),
  officeNameInput: document.querySelector("#office-name-input"),
  officeLatitudeInput: document.querySelector("#office-latitude-input"),
  officeLongitudeInput: document.querySelector("#office-longitude-input"),
  officeTable: document.querySelector("#office-table"),
  reportTable: document.querySelector("#report-table"),
  tabs: document.querySelectorAll(".tab"),
  downloadReportButton: document.querySelector("#download-report-button")
};

let employees = readEmployees();
let offices = readOffices();
let activeReport = "daily";
let lastReport = { headers: [], rows: [] };
const store = createLocalStore();

function init() {
  renderAdminDate();
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", handleLogout);
  els.employeeConfigForm.addEventListener("submit", handleEmployeeSave);
  els.officeConfigForm.addEventListener("submit", handleOfficeSave);
  els.employeeTable.addEventListener("click", handleEmployeeTableClick);
  els.officeTable.addEventListener("click", handleOfficeTableClick);
  els.downloadReportButton.addEventListener("click", downloadActiveReport);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeReport = tab.dataset.report;
      els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      renderReports().catch(handleAsyncError);
    });
  });

  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "active") {
    showDashboard();
  }
}

function handleLogin(event) {
  event.preventDefault();
  const configuredPasscode = window.ATTENDANCE_ADMIN_PASSCODE || DEFAULT_ADMIN_PASSCODE;

  if (els.passwordInput.value !== configuredPasscode) {
    setLoginStatus("Invalid passcode.", true);
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, "active");
  els.passwordInput.value = "";
  setLoginStatus("");
  showDashboard();
}

function handleLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  els.dashboard.hidden = true;
  els.loginPanel.hidden = false;
}

function showDashboard() {
  els.loginPanel.hidden = true;
  els.dashboard.hidden = false;
  renderAdminTables();
  renderReports().catch(handleAsyncError);
}

function renderAdminDate() {
  els.currentDay.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long"
  });
}

function handleEmployeeSave(event) {
  event.preventDefault();
  const id = normalizeId(els.employeeIdInput.value);
  const name = els.employeeNameInput.value.trim();

  if (!id || !name) {
    return;
  }

  const existingIndex = employees.findIndex((employee) => employee.id === id);
  const employee = { id, name };

  if (existingIndex >= 0) {
    employees[existingIndex] = employee;
  } else {
    employees.push(employee);
  }

  saveEmployees(employees);
  els.employeeConfigForm.reset();
  renderAdminTables();
  renderReports().catch(handleAsyncError);
}

function handleOfficeSave(event) {
  event.preventDefault();
  const id = normalizeId(els.officeIdInput.value);
  const name = els.officeNameInput.value.trim();
  const latitude = Number(els.officeLatitudeInput.value);
  const longitude = Number(els.officeLongitudeInput.value);

  if (!id || !name || !isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    setLoginStatus("Enter a valid office name, latitude, and longitude.", true);
    return;
  }

  const office = normalizeOffice({ id, name, latitude, longitude });
  const existingIndex = offices.findIndex((item) => item.id === id);

  if (existingIndex >= 0) {
    offices[existingIndex] = office;
  } else {
    offices.push(office);
  }

  saveOffices(offices);
  els.officeConfigForm.reset();
  renderAdminTables();
}

function handleEmployeeTableClick(event) {
  const button = event.target.closest("button[data-remove-employee]");
  if (!button || employees.length <= 1) {
    return;
  }

  employees = employees.filter((employee) => employee.id !== button.dataset.removeEmployee);
  saveEmployees(employees);
  renderAdminTables();
  renderReports().catch(handleAsyncError);
}

function handleOfficeTableClick(event) {
  const button = event.target.closest("button[data-remove-office]");
  if (!button) {
    return;
  }

  offices = offices.filter((office) => office.id !== button.dataset.removeOffice);
  saveOffices(offices);
  renderAdminTables();
}

function renderAdminTables() {
  renderStaticTable(
    els.employeeTable,
    ["Employee ID", "Name", "Action"],
    employees.map((employee) => [
      employee.id,
      employee.name,
      `<button class="row-button" type="button" data-remove-employee="${escapeHtml(employee.id)}">Remove</button>`
    ])
  );

  renderStaticTable(
    els.officeTable,
    ["Office ID", "Name", "Latitude", "Longitude", "Radius", "Action"],
    offices.map((office) => [
      office.id,
      office.name,
      office.latitude.toFixed(6),
      office.longitude.toFixed(6),
      `${office.radiusMeters} m`,
      `<button class="row-button" type="button" data-remove-office="${escapeHtml(office.id)}">Remove</button>`
    ])
  );
}

async function renderReports() {
  const records = await store.listAttendance();

  if (activeReport === "daily") {
    const today = formatDateKey(new Date());
    const todayRecords = records.filter((record) => record.date === today);
    renderReport(
      ["Employee", "Date", "Check-In Time", "Status", "Office", "Distance From Office"],
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
    renderReport(
      ["Employee", "Office Days", "Remote Days", "Not Checked In"],
      employees.map((employee) => summarizeEmployee(employee, records, weekDates))
    );
    return;
  }

  const monthDates = workingDatesInCurrentMonth();
  renderReport(
    [
      "Employee",
      "Working Days",
      "Office Days",
      "Remote Days",
      "Not Checked In",
      "Late Check-Ins",
      "Average Check-In Time"
    ],
    employees.map((employee) => summarizeEmployeeMonth(employee, records, monthDates))
  );
}

function renderReport(headers, rows) {
  lastReport = { headers, rows };
  renderStaticTable(
    els.reportTable,
    headers,
    rows.length ? rows : [[`No ${activeReport} attendance records yet.`]],
    rows.length ? 0 : headers.length
  );
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

function downloadActiveReport() {
  const rows = [lastReport.headers, ...lastReport.rows];
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
}

function renderStaticTable(table, headers, rows, emptyColspan = 0) {
  table.innerHTML = `
    <thead>
      <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map((row) => {
          if (emptyColspan) {
            return `<tr><td class="empty-row" colspan="${emptyColspan}">${escapeHtml(row[0])}</td></tr>`;
          }

          return `<tr>${row.map((cell) => renderCell(cell)).join("")}</tr>`;
        })
        .join("")}
    </tbody>
  `;
}

function renderCell(cell) {
  const value = String(cell);
  if (value.startsWith("<button ")) {
    return `<td>${value}</td>`;
  }

  return `<td>${escapeHtml(value)}</td>`;
}

function setLoginStatus(message, isError = false) {
  els.loginStatus.textContent = message;
  els.loginStatus.classList.toggle("is-error", isError);
}

function handleAsyncError(error) {
  setLoginStatus(error.message, true);
}

void OFFICE_RADIUS_METERS;
init();
