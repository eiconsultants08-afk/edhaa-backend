import ExcelJS from "exceljs";

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob) {
  if (!dob) return "-";
  const b = new Date(dob);
  if (isNaN(b.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  ) age--;
  return age >= 0 ? String(age) : "-";
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function statusFor(r, gender) {
  if (r.value_text) {
    const v = (r.value_text || "").toUpperCase();
    if (v === "POSITIVE") return "POSITIVE";
    if (v === "NEGATIVE") return "NEGATIVE";
    return r.value_text;
  }
  if (r.value_num == null) return "-";
  const v = Number(r.value_num);
  const tt = r.testType || {};
  const g = (gender || "").toUpperCase();

  const critLow  = tt.critical_low  != null ? Number(tt.critical_low)  : null;
  const critHigh = tt.critical_high != null ? Number(tt.critical_high) : null;
  if (critLow != null && v <= critLow)   return "CRITICAL LOW";
  if (critHigh != null && v >= critHigh) return "CRITICAL HIGH";

  const min =
    g === "MALE"   && tt.male_min   != null ? Number(tt.male_min)   :
    g === "FEMALE" && tt.female_min != null ? Number(tt.female_min) :
    tt.normal_min  != null ? Number(tt.normal_min) : null;
  const max =
    g === "MALE"   && tt.male_max   != null ? Number(tt.male_max)   :
    g === "FEMALE" && tt.female_max != null ? Number(tt.female_max) :
    tt.normal_max  != null ? Number(tt.normal_max) : null;

  if (min != null && max != null) return v < min ? "LOW" : v > max ? "HIGH" : "NORMAL";
  if (min == null && max != null) return v > max ? "HIGH" : "NORMAL";
  if (min != null && max == null) return v < min ? "LOW"  : "NORMAL";
  return "-";
}

function bioRef(tt, gender) {
  if (!tt) return "-";
  if (tt.reference_text) {
    const lines = tt.reference_text.split("\n").map(l => l.trim()).filter(Boolean);
    const g = (gender || "").toUpperCase();
    if (g && lines.length > 1) {
      const genderLine = lines.find(l => l.toUpperCase().startsWith(g));
      if (genderLine) {
        const cleaned = genderLine.replace(/^(Male|Female)\s*:\s*/i, "").trim();
        if (cleaned) return cleaned;
      }
    }
    let firstLine = lines[0] || "";
    firstLine = firstLine.replace(/^(Male|Female)\s*:\s*/i, "").trim();
    if (firstLine) return firstLine;
  }
  const g = (gender || "").toUpperCase();
  const min =
    g === "MALE"   && tt.male_min   != null ? Number(tt.male_min)   :
    g === "FEMALE" && tt.female_min != null ? Number(tt.female_min) :
    tt.normal_min  != null ? Number(tt.normal_min) : null;
  const max =
    g === "MALE"   && tt.male_max   != null ? Number(tt.male_max)   :
    g === "FEMALE" && tt.female_max != null ? Number(tt.female_max) :
    tt.normal_max  != null ? Number(tt.normal_max) : null;
  if (min != null && max != null) return `${min} - ${max}`;
  if (min == null && max != null) return `< ${max}`;
  if (min != null && max == null) return `> ${min}`;
  return "-";
}

// ── Status → fill colour (Status column only) ─────────────────────────────────
const STATUS_STYLES = {
  "NORMAL":        { fill: "FF92D050", font: "FF000000" },  // light green
  "HIGH":          { fill: "FFFF0000", font: "FFFFFFFF" },  // red
  "LOW":           { fill: "FFFFC000", font: "FF000000" },  // orange
  "CRITICAL HIGH": { fill: "FFC00000", font: "FFFFFFFF" },  // dark red
  "CRITICAL LOW":  { fill: "FFE26B0A", font: "FFFFFFFF" },  // dark orange
  "NEGATIVE": { fill: "FF92D050", font: "FF000000" }, // green
  "POSITIVE": { fill: "FFFF0000", font: "FFFFFFFF" }, // red
};

// ── Main builder ───────────────────────────────────────────────────────────────

export async function buildTestResultsXlsx(histories, meta = {}) {
  const orgName    = meta.orgName    || "EDHAA Diagnostic";
  const orgAddress = meta.orgAddress || "";

  const wb = new ExcelJS.Workbook();
  wb.creator = orgName;
  wb.created = new Date();

  const ws = wb.addWorksheet("Medical Test Results", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  // ── Column widths ───────────────────────────────────────────────────────────
  ws.columns = [
    { key: "patient_id",   width: 13 },
    { key: "patient_name", width: 22 },
    { key: "age",          width: 7  },
    { key: "gender",       width: 10 },
    { key: "test_name",    width: 22 },
    { key: "test_value",   width: 13 },
    { key: "unit",         width: 11 },
    { key: "bio_ref",      width: 26 },
    { key: "status",       width: 16 },
    { key: "date",         width: 13 },
  ];

  // ── Row 1: Org name ─────────────────────────────────────────────────────────
  ws.mergeCells("A1:J1");
  const orgCell = ws.getCell("A1");
  orgCell.value = orgName;
  orgCell.font  = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1F3864" } };
  orgCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // ── Row 2: Org address ──────────────────────────────────────────────────────
  ws.mergeCells("A2:J2");
  const addrCell = ws.getCell("A2");
  addrCell.value = orgAddress;
  addrCell.font  = { name: "Calibri", size: 10, italic: true, color: { argb: "FF555555" } };
  addrCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = orgAddress ? 18 : 4;

  // ── Row 3: Generated date ───────────────────────────────────────────────────
  ws.mergeCells("A3:J3");
  const now     = new Date();
  const subCell = ws.getCell("A3");
  subCell.value = `Generated on: ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  subCell.font  = { name: "Calibri", size: 9, italic: true, color: { argb: "FF888888" } };
  subCell.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(3).height = 16;

  // ── Row 4: Spacer ───────────────────────────────────────────────────────────
  ws.getRow(4).height = 4;

  // ── Row 5: Column headers ───────────────────────────────────────────────────
  const HEADERS = [
    "Patient ID", "Patient Name", "Age", "Gender", "Test Name",
    "Test Value", "Unit", "Biological Reference", "Status", "Date",
  ];

  const headerRow = ws.getRow(5);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder("FF000000");
  });
  headerRow.height = 22;

  // ── Data rows ───────────────────────────────────────────────────────────────
  let rowIdx = 6;

  for (const h of histories) {
    const raw     = typeof h.get === "function" ? h.get({ plain: true }) : h;
    const patient = raw.patient || {};
    const dateStr = fmtDate(raw.test_date);
    const gender  = patient.gender || "-";
    const age     = calcAge(patient.dob);
    const results = raw.results || [];

    const writeRow = (testName, val, unit, bioRefStr, status) => {
      const row = ws.getRow(rowIdx);
      row.getCell(1).value  = patient.patient_id || "-";
      row.getCell(2).value  = patient.name || "-";
      row.getCell(3).value  = age;
      row.getCell(4).value  = gender;
      row.getCell(5).value  = testName;
      row.getCell(6).value  = val;
      row.getCell(7).value  = unit;
      row.getCell(8).value  = bioRefStr;
      row.getCell(9).value  = status;
      row.getCell(10).value = dateStr;
      applyDataRowStyle(row, status);
      rowIdx++;
    };

    if (results.length === 0) {
      writeRow("-", "-", "-", "-", "-");
      continue;
    }

    for (const r of results) {
      const tt        = r.testType || {};
      const testName  = tt.full_name || tt.name || "-";
      const unit      = tt.unit || "-";
      const val       = r.value_text ?? (r.value_num != null ? Number(r.value_num) : "-");
      const status    = statusFor(r, gender);
      const bioRefStr = bioRef(tt, gender);
      writeRow(testName, val, unit, bioRefStr, status);
    }
  }

  // ── Auto-filter ─────────────────────────────────────────────────────────────
  if (rowIdx > 6) {
    ws.autoFilter = { from: "A5", to: `J${rowIdx - 1}` };
  }

  return wb.xlsx.writeBuffer();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function thinBorder(argb) {
  return {
    top:    { style: "thin", color: { argb } },
    bottom: { style: "thin", color: { argb } },
    left:   { style: "thin", color: { argb } },
    right:  { style: "thin", color: { argb } },
  };
}

function applyDataRowStyle(row, status) {
  const statusStyle = STATUS_STYLES[status] || null;
  const border      = thinBorder("FFD0D0D0");

  for (let c = 1; c <= 10; c++) {
    const cell = row.getCell(c);
    cell.font      = { name: "Calibri", size: 10, color: { argb: "FF000000" } };
    cell.border    = border;
    cell.alignment = { horizontal: "center", vertical: "middle" };

    if (c === 2) cell.alignment = { horizontal: "left", vertical: "middle" };
    if (c === 8) cell.alignment = { horizontal: "left", vertical: "middle" };

    if (c === 9 && statusStyle) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusStyle.fill } };
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: statusStyle.font } };
    }
  }

  row.height = 20;
}
