import { formatCsvCell, formatDateKey, formatTime } from "../attendance-data.js";

const STATUS_STYLES = {
  WFO: "StatusWFO",
  WFH: "StatusWFH",
  L: "StatusLeave"
};

export const DAILY_REPORT_HEADERS = [
  "Employee",
  "Date",
  "Check-In Time",
  "Status",
  "Office",
  "Distance From Office"
];

export const WEEKLY_REPORT_HEADERS = ["Employee", "Office Days", "Remote Days", "Not Checked In"];

export function createDailyReportRows(records, now = new Date()) {
  const today = formatDateKey(now);
  return records
    .filter((record) => record.date === today)
    .map((record) => [
      record.employeeName,
      record.date,
      formatTime(record.checkInTime),
      record.status,
      record.officeName,
      `${record.distanceFromOfficeMeters} m`
    ]);
}

export function createWeeklyReportRows(employees, records, now = new Date()) {
  const weekDates = datesInWeek(now);
  return employees.map((employee) => summarizeEmployee(employee, records, weekDates));
}

export function createMonthlyReportRows(employees, records, now = new Date(), asOf = new Date()) {
  const monthDates = workingDatesInMonth(now, asOf);
  return employees.map((employee) => buildStatusEmployeeRow(employee, records, monthDates));
}

export function createMonthlyReportHeaders(now = new Date(), asOf = new Date()) {
  return [
    "Employee ID",
    "Employee",
    ...workingDatesInMonth(now, asOf).map(formatDateHeader),
    "WFO",
    "WFH",
    "L"
  ];
}

export function downloadDailyReport(records, now = new Date()) {
  const csv = buildDailyCsv(records, now);
  triggerFileDownload(
    csv,
    "text/csv;charset=utf-8",
    `daily-attendance-${formatDateKey(now)}.csv`
  );
}

export function downloadWeeklyReport(employees, records, now = new Date()) {
  const week = weekForDate(now);
  const workbook = buildWeekWiseWorkbook(employees, records, [week]);
  triggerFileDownload(
    workbook,
    "application/vnd.ms-excel;charset=utf-8",
    `weekly-attendance-${week.key}-to-${formatDateKey(week.dates[week.dates.length - 1])}.xls`
  );
}

export function downloadMonthlyReport(employees, records, now = new Date(), asOf = new Date()) {
  const workbook = buildMonthlyWorkbook(employees, records, now, asOf);
  triggerFileDownload(
    workbook,
    "application/vnd.ms-excel;charset=utf-8",
    `monthly-attendance-${formatMonthKey(now)}.xls`
  );
}

export function buildDailyCsv(records, now = new Date()) {
  const rows = [DAILY_REPORT_HEADERS, ...createDailyReportRows(records, now)];
  return rows.map((row) => row.map(formatCsvCell).join(",")).join("\n");
}

export function buildMonthlyWorkbook(employees, records, now = new Date(), asOf = new Date()) {
  const rows = [
    createMonthlyReportHeaders(now, asOf),
    ...createMonthlyReportRows(employees, records, now, asOf)
  ];

  return buildWorkbook([
    buildWorksheet("Monthly Attendance", rows, { headerRowIndexes: [0] })
  ]);
}

export function buildWeekWiseWorkbook(employees, records, weeks) {
  const worksheets = weeks.map((week, index) => {
    const headers = [
      "Employee ID",
      "Employee",
      ...week.dates.map((date) => formatWeekdayHeader(date)),
      "WFO",
      "WFH",
      "L"
    ];
    const rows = employees.map((employee) => buildStatusEmployeeRow(employee, records, week.dates));

    return buildWorksheet(`Week ${index + 1}`, [[week.label], headers, ...rows], {
      headerRowIndexes: [0, 1]
    });
  });

  return buildWorkbook(worksheets);
}

export function weekForDate(now = new Date()) {
  const monday = startOfWeek(now);
  const dates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });

  return {
    key: formatDateKey(dates[0]),
    dates,
    label: `${formatDateLabel(dates[0])} - ${formatDateLabel(dates[dates.length - 1])}`
  };
}

export function weeksInMonth(now = new Date()) {
  const selectedMonth = startOfMonth(now);
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const weeks = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
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

export function datesInWeek(now = new Date()) {
  return weekForDate(now).dates.map(formatDateKey);
}

export function workingDatesInMonth(now = new Date(), asOf = new Date()) {
  const selectedMonth = startOfMonth(now);
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const asOfMonth = formatMonthKey(asOf);
  const selectedMonthKey = formatMonthKey(selectedMonth);
  const endDay = selectedMonthKey === asOfMonth ? asOf.getDate() : daysInMonth;

  if (selectedMonthKey > asOfMonth) {
    return [];
  }

  const dates = [];

  for (let day = 1; day <= endDay; day += 1) {
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(formatDateKey(date));
    }
  }

  return dates;
}

export function formatMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function triggerFileDownload(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildWorkbook(worksheets) {
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
    <Style ss:ID="StatusWFO">
      <Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="StatusWFH">
      <Interior ss:Color="#BDD7EE" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="StatusLeave">
      <Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${worksheets.join("")}
</Workbook>`;
}

function buildWorksheet(name, rows, { headerRowIndexes = [] } = {}) {
  return `
      <Worksheet ss:Name="${escapeXml(name)}">
        <Table>
          ${rows
            .map((row, index) => spreadsheetRow(row, headerRowIndexes.includes(index) ? "Header" : ""))
            .join("")}
        </Table>
      </Worksheet>`;
}

function buildStatusEmployeeRow(employee, records, dates) {
  const statuses = dates.map((date) => attendanceCodeForDate(employee, records, date));
  const wfoDays = statuses.filter((status) => status === "WFO").length;
  const wfhDays = statuses.filter((status) => status === "WFH").length;
  const leaveDays = statuses.filter((status) => status === "L").length;

  return [employee.id, employee.name, ...statuses, wfoDays, wfhDays, leaveDays];
}

function attendanceCodeForDate(employee, records, date) {
  const dateKey = typeof date === "string" ? date : formatDateKey(date);
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

function summarizeEmployee(employee, records, dates) {
  const employeeRecords = records.filter(
    (record) => record.employeeId === employee.id && dates.includes(record.date)
  );
  const officeDays = employeeRecords.filter((record) => record.status === "OFFICE").length;
  const remoteDays = employeeRecords.filter((record) => record.status === "REMOTE").length;
  return [employee.name, officeDays, remoteDays, dates.length - employeeRecords.length];
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

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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

function formatDateHeader(dateKey) {
  return formatWeekdayHeader(dateFromKey(dateKey));
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function spreadsheetRow(values, styleId = "") {
  return `<Row>${values.map((value) => spreadsheetCell(value, styleId)).join("")}</Row>`;
}

function spreadsheetCell(value, rowStyleId = "") {
  const cellStyleId = rowStyleId || STATUS_STYLES[value] || "";
  const style = cellStyleId ? ` ss:StyleID="${cellStyleId}"` : "";
  return `<Cell${style}><Data ss:Type="${typeof value === "number" ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
