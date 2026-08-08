import {
  MAX_GPS_ACCURACY_METERS,
  createLocalStore,
  findNearestOffice,
  formatDateKey,
  formatTime,
  readEmployees,
  readOffices,
  escapeHtml
} from "./attendance-data.js";

const els = {
  employeeSelect: document.querySelector("#employee-select"),
  employeeName: document.querySelector("#employee-name"),
  currentDay: document.querySelector("#current-day"),
  currentDate: document.querySelector("#current-date"),
  checkInButton: document.querySelector("#check-in-button"),
  statusLine: document.querySelector("#status-line"),
  resultPanel: document.querySelector("#result-panel"),
  resultMark: document.querySelector("#result-mark"),
  resultTitle: document.querySelector("#result-title"),
  resultEmployee: document.querySelector("#result-employee"),
  resultTime: document.querySelector("#result-time"),
  resultLocation: document.querySelector("#result-location"),
  resultStatus: document.querySelector("#result-status")
};

let employees = readEmployees();
const store = createLocalStore();

function init() {
  renderToday();
  populateEmployees();
  els.employeeSelect.addEventListener("change", () => {
    employees = readEmployees();
    els.employeeName.textContent = selectedEmployee().name;
    renderExistingCheckIn().catch(handleAsyncError);
  });
  els.checkInButton.addEventListener("click", handleCheckIn);
  renderExistingCheckIn().catch(handleAsyncError);
}

function populateEmployees() {
  employees = employees.length ? employees : readEmployees();
  els.employeeSelect.innerHTML = employees
    .map((employee) => `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.name)}</option>`)
    .join("");
  els.employeeName.textContent = selectedEmployee().name;
}

function renderToday() {
  const today = new Date();
  els.currentDay.textContent = today.toLocaleDateString("en-IN", {
    weekday: "long"
  });
  els.currentDate.textContent = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  els.currentDate.dateTime = formatDateKey(today);
}

async function renderExistingCheckIn() {
  const employee = selectedEmployee();
  const date = formatDateKey(new Date());
  const existing = await store.getAttendance(employee.id, date);

  if (existing) {
    showAttendance(existing, "already");
    setStatus("You have already checked in today.");
    return;
  }

  els.resultPanel.hidden = true;
  setStatus("");
}

async function handleCheckIn() {
  const employee = selectedEmployee();
  const date = formatDateKey(new Date());
  setLoading(true);
  setStatus("Checking today's attendance...");

  try {
    const existing = await store.getAttendance(employee.id, date);
    if (existing) {
      showAttendance(existing, "already");
      setStatus("You have already checked in today.");
      return;
    }

    setStatus("Requesting location permission...");
    const position = await getCurrentPosition();
    const { latitude, longitude, accuracy } = position.coords;

    if (accuracy > MAX_GPS_ACCURACY_METERS) {
      throw new Error("Current location is not accurate enough. Please retry.");
    }

    const officeMatch = findNearestOffice(readOffices(), latitude, longitude);
    const now = new Date();
    const attendance = {
      employeeId: employee.id,
      employeeName: employee.name,
      date,
      checkInTime: now.toISOString(),
      latitude,
      longitude,
      accuracyMeters: Math.round(accuracy),
      status: officeMatch.isOffice ? "OFFICE" : "REMOTE",
      officeId: officeMatch.office.id,
      officeName: officeMatch.office.name,
      distanceFromOfficeMeters: Math.round(officeMatch.distanceMeters),
      deviceType: detectDeviceType(),
      browser: detectBrowser(),
      createdAt: now.toISOString()
    };

    const savedAttendance = await store.createAttendance(attendance);
    showAttendance(savedAttendance, "success");
    setStatus("Attendance saved.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
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

function showAttendance(attendance, mode) {
  els.resultPanel.hidden = false;
  els.resultMark.classList.toggle("is-warning", mode === "already");
  els.resultMark.textContent = mode === "already" ? "!" : "✓";
  els.resultTitle.textContent =
    mode === "already" ? "Already Checked In Today" : "Check-In Successful";
  els.resultEmployee.textContent = attendance.employeeName;
  els.resultTime.textContent = formatTime(attendance.checkInTime);
  els.resultLocation.textContent = attendance.officeName;
  els.resultStatus.textContent = attendance.status;
}

function selectedEmployee() {
  return employees.find((employee) => employee.id === els.employeeSelect.value) ?? employees[0];
}

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

function setStatus(message, isError = false) {
  els.statusLine.textContent = message;
  els.statusLine.classList.toggle("is-error", isError);
}

function setLoading(isLoading) {
  els.checkInButton.disabled = isLoading;
  els.checkInButton.textContent = isLoading ? "CHECKING IN..." : "CHECK IN";
}

function handleAsyncError(error) {
  setStatus(error.message, true);
}

init();
