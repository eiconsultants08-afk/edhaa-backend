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
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function statusFor(r, gender) {
  if (r.value_text) return r.value_text;
  if (r.value_num == null) return "-";
  const v = Number(r.value_num);
  const tt = r.testType || {};
  const g = (gender || "").toUpperCase();
  const min =
    g === "MALE"   && tt.male_min   != null ? Number(tt.male_min)   :
    g === "FEMALE" && tt.female_min != null ? Number(tt.female_min) :
    tt.normal_min  != null ? Number(tt.normal_min) : null;
  const max =
    g === "MALE"   && tt.male_max   != null ? Number(tt.male_max)   :
    g === "FEMALE" && tt.female_max != null ? Number(tt.female_max) :
    tt.normal_max  != null ? Number(tt.normal_max) : null;

  const critLow  = tt.critical_low  != null ? Number(tt.critical_low)  : null;
  const critHigh = tt.critical_high != null ? Number(tt.critical_high) : null;

  // Critical checks first
  if (critLow != null && v <= critLow) return "CRITICAL LOW";
  if (critHigh != null && v >= critHigh) return "CRITICAL HIGH";

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
    // Try to find a gender-specific line first
    if (g && lines.length > 1) {
      const genderLine = lines.find(l => l.toUpperCase().startsWith(g));
      if (genderLine) {
        const cleaned = genderLine.replace(/^(Male|Female)\s*:\s*/i, "").trim();
        if (cleaned) return cleaned;
      }
    }
    // Fallback: first line, strip any gender prefix
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

// ── Colour mapping ─────────────────────────────────────────────────────────────

// Status → { fill colour for status column, fill colour for value column }
const STATUS_STYLES = {
  "NORMAL":        { statusFill: "FF92D050", valueFill: "FF92D050", fontColor: "FF000000" },  // light green
  "HIGH":          { statusFill: "FFFF0000", valueFill: "FFFF0000", fontColor: "FFFFFFFF" },  // red
  "LOW":           { statusFill: "FFFFC000", valueFill: "FFFFC000", fontColor: "FF000000" },  // orange
  "CRITICAL HIGH": { statusFill: "FFC00000", valueFill: "FFC00000", fontColor: "FFFFFFFF" },  // dark red
  "CRITICAL LOW":  { statusFill: "FFE26B0A", valueFill: "FFE26B0A", fontColor: "FFFFFFFF" },  // dark orange
  "Positive":      { statusFill: "FF92D050", valueFill: "FF92D050", fontColor: "FF000000" },  // green
  "Negative":      { statusFill: "FFFF0000", valueFill: "FFFF0000", fontColor: "FFFFFFFF" },  // red
  "POSITIVE":      { statusFill: "FF92D050", valueFill: "FF92D050", fontColor: "FF000000" },  // green
  "NEGATIVE":      { statusFill: "FFFF0000", valueFill: "FFFF0000", fontColor: "FFFFFFFF" },  // red
};

const DEFAULT_STYLE = { statusFill: null, valueFill: null, fontColor: "FF000000" };

// ── Main builder ───────────────────────────────────────────────────────────────

/**
 * Builds a styled Excel workbook (.xlsx) from histories array.
 * @param {Array} histories — from getResultsForCsvExport (Sequelize instances)
 * @returns {Promise<Buffer>} xlsx buffer
 */
export async function buildTestResultsXlsx(histories) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EDHAA Diagnostic";
  wb.created = new Date();

  const ws = wb.addWorksheet("Medical Test Results", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  // ── Column definitions ──────────────────────────────────────────────────────
  ws.columns = [
    { header: "", key: "patient_id",   width: 14 },
    { header: "", key: "patient_name", width: 22 },
    { header: "", key: "age",          width: 8  },
    { header: "", key: "gender",       width: 10 },
    { header: "", key: "test_name",    width: 20 },
    { header: "", key: "test_value",   width: 14 },
    { header: "", key: "unit",         width: 10 },
    { header: "", key: "bio_ref",      width: 22 },
    { header: "", key: "status",       width: 18 },
    { header: "", key: "date",         width: 14 },
  ];

  // ── Row 1: Title ────────────────────────────────────────────────────────────
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "MEDICAL TEST RESULTS REPORT";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1F3864" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // ── Row 2: Generated date ───────────────────────────────────────────────────
  ws.mergeCells("A2:J2");
  const subCell = ws.getCell("A2");
  const now = new Date();
  subCell.value = `Generated on: ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF555555" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  // ── Row 3: Blank spacer ─────────────────────────────────────────────────────
  ws.getRow(3).height = 10;

  // ── Row 4: Header row ───────────────────────────────────────────────────────
  const HEADERS = [
    "Patient ID", "Patient Name", "Age", "Gender", "Test Name",
    "Test Value", "Unit", "Biological Reference", "Status", "Date",
  ];

  const headerRow = ws.getRow(4);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: "FF1F3864" },   // dark navy
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left:   { style: "thin", color: { argb: "FF000000" } },
      right:  { style: "thin", color: { argb: "FF000000" } },
    };
  });
  headerRow.height = 22;

  // ── Data rows ───────────────────────────────────────────────────────────────
  let rowIdx = 5;

  for (const h of histories) {
    const raw = typeof h.get === "function" ? h.get({ plain: true }) : h;
    const patient  = raw.patient   || {};
    const dateStr  = fmtDate(raw.test_date);
    const gender   = patient.gender || "-";
    const age      = calcAge(patient.dob);
    const results  = raw.results || [];

    if (results.length === 0) {
      const row = ws.getRow(rowIdx);
      row.getCell(1).value = patient.patient_id || "-";
      row.getCell(2).value = patient.name || "-";
      row.getCell(3).value = age;
      row.getCell(4).value = gender;
      row.getCell(5).value = "-";
      row.getCell(6).value = "-";
      row.getCell(7).value = "-";
      row.getCell(8).value = "-";
      row.getCell(9).value = "-";
      row.getCell(10).value = dateStr;
      applyDataRowStyle(row, null, 10);
      rowIdx++;
      continue;
    }

    for (const r of results) {
      const tt   = r.testType || {};
      const name = tt.full_name
        ? `${tt.name}`
        : (tt.name || "-");
      const unit = tt.unit || "-";
      const val  = r.value_text ?? (r.value_num != null ? Number(r.value_num) : "-");
      const status   = statusFor(r, gender);
      const bioRefStr = bioRef(tt, gender);

      const row = ws.getRow(rowIdx);
      row.getCell(1).value = patient.patient_id || "-";
      row.getCell(2).value = patient.name || "-";
      row.getCell(3).value = age;
      row.getCell(4).value = gender;
      row.getCell(5).value = name;
      row.getCell(6).value = val;
      row.getCell(7).value = unit;
      row.getCell(8).value = bioRefStr;
      row.getCell(9).value = status;
      row.getCell(10).value = dateStr;

      applyDataRowStyle(row, status, 10);
      rowIdx++;
    }
  }

  // ── Auto-filter ─────────────────────────────────────────────────────────────
  if (rowIdx > 5) {
    ws.autoFilter = { from: "A4", to: `J${rowIdx - 1}` };
  }

  // ── Generate buffer ─────────────────────────────────────────────────────────
  return wb.xlsx.writeBuffer();
}

// ── Row styling helper ─────────────────────────────────────────────────────────

function applyDataRowStyle(row, status, colCount) {
  const styles = STATUS_STYLES[status] || DEFAULT_STYLE;

  const thinBorder = {
    top:    { style: "thin", color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
    left:   { style: "thin", color: { argb: "FFD0D0D0" } },
    right:  { style: "thin", color: { argb: "FFD0D0D0" } },
  };

  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: "Calibri", size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;

    // Columns A (1) & B (2) left-aligned
    if (c === 2) cell.alignment = { horizontal: "left", vertical: "middle" };

    // Test Value column (6) — coloured fill
    if (c === 6 && styles.valueFill) {
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: styles.valueFill },
      };
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: styles.fontColor } };
    }

    // Status column (9) — coloured fill
    if (c === 9 && styles.statusFill) {
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: styles.statusFill },
      };
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: styles.fontColor } };
    }
  }

  row.height = 20;
}
