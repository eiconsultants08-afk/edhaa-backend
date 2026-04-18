import PDFDocument from "pdfkit";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN  = 40;
const CW      = PAGE_W - 2 * MARGIN; // 515.28

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GRAY  = "#666666";

// Result status colours — the ONLY colours used; only in session/single-test reports
const COLOR_NORMAL = "#11865B";  // green  — normal / negative
const COLOR_HIGH   = "#B42318";  // red    — high / positive
const COLOR_LOW    = "#A05A00";  // orange — low

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) age--;
  return age >= 0 ? age : null;
}

function statusFor(r, gender) {
  if (r.is_qualitative || r.value_text) {
    const v = (r.value_text || "").toUpperCase();
    if (v === "POSITIVE") return "POSITIVE";
    if (v === "NEGATIVE") return "NEGATIVE";
    return r.value_text || null;
  }
  if (r.value_num == null) return null;
  const v = Number(r.value_num);
  const g = (gender || "").toUpperCase();

  const min =
    g === "MALE"   && r.male_min   != null ? Number(r.male_min)   :
    g === "FEMALE" && r.female_min != null ? Number(r.female_min) :
    r.normal_min   != null ? Number(r.normal_min) : null;
  const max =
    g === "MALE"   && r.male_max   != null ? Number(r.male_max)   :
    g === "FEMALE" && r.female_max != null ? Number(r.female_max) :
    r.normal_max   != null ? Number(r.normal_max) : null;

  if (min != null && max != null) {
    if (v < min) return "LOW";
    if (v > max) return "HIGH";
    return "NORMAL";
  }
  if (min == null && max != null) return v > max ? "HIGH" : "NORMAL";
  if (min != null && max == null) return v < min ? "LOW"  : "NORMAL";
  return null;
}

function statusColor(status) {
  if (status === "HIGH"   || status === "POSITIVE") return COLOR_HIGH;
  if (status === "LOW")                              return COLOR_LOW;
  if (status === "NORMAL" || status === "NEGATIVE") return COLOR_NORMAL;
  return BLACK;
}

/**
 * Replace characters outside PDFKit's built-in Helvetica glyph set (WinAnsi).
 * Must be called on every string before it is passed to doc.text().
 * Key offenders: μ (U+03BC micro), µ (U+00B5 micro sign).
 */
function sanitize(str) {
  if (!str) return str;
  return str
    .replace(/[μµ]/g, "u")    // micro → u  (cell/uL, ug/dL, umol/L)
    .replace(/[–—]/g, "-")    // en/em dash → hyphen
    .replace(/≥/g,    ">=")
    .replace(/≤/g,    "<=")
    .replace(/[^\x00-\xFF]/g, "?"); // catch-all for any other non-Latin-1
}

function shortMethod(raw) {
  if (!raw) return "-";
  return raw
    .replace(/\s+Method$/i, "")
    .replace(/\s+Equation$/i, "")
    .replace(/\s+Test$/i, "")
    .trim();
}

function methodCell(r) {
  const method = shortMethod(r.method_used || r.method || "");
  if ((r.specimen_type || "") === "Calculated") return "Calculated";
  return method || "-";
}

function bioReference(r, gender) {
  if (r.reference_text) {
    const firstLine = r.reference_text.split("\n")[0].trim();
    if (firstLine) return sanitize(firstLine);
  }
  const unit = sanitize(r.test_type_unit || r.unit || "");
  const g = (gender || "").toUpperCase();
  const min =
    g === "MALE"   && r.male_min   != null ? Number(r.male_min)   :
    g === "FEMALE" && r.female_min != null ? Number(r.female_min) :
    r.normal_min   != null ? Number(r.normal_min) : null;
  const max =
    g === "MALE"   && r.male_max   != null ? Number(r.male_max)   :
    g === "FEMALE" && r.female_max != null ? Number(r.female_max) :
    r.normal_max   != null ? Number(r.normal_max) : null;
  if (min != null && max != null) return `${min} - ${max}${unit ? " " + unit : ""}`;
  if (min == null && max != null) return `< ${max}${unit ? " " + unit : ""}`;
  if (min != null && max == null) return `> ${min}${unit ? " " + unit : ""}`;
  return "-";
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d    = new Date(iso);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ── Drawing primitives ─────────────────────────────────────────────────────────

function hline(doc, y, lw = 0.5, color = BLACK) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y)
     .strokeColor(color).lineWidth(lw).stroke();
}

function vline(doc, x, y1, y2, lw = 0.5, color = BLACK) {
  doc.moveTo(x, y1).lineTo(x, y2)
     .strokeColor(color).lineWidth(lw).stroke();
}

// ── Header — plain text, no fills ─────────────────────────────────────────────

function drawHeader(doc, orgName, deptName) {
  let y = MARGIN;

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(16)
     .text(orgName, MARGIN, y, { width: CW, align: "center", lineBreak: false });
  y += 22;

  if (deptName) {
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
       .text(`DEPARTMENT OF ${deptName.toUpperCase()}`, MARGIN, y,
         { width: CW, align: "center", lineBreak: false });
    y += 16;
  }

  hline(doc, y, 1, BLACK);
  return y + 10;
}

// ── Section heading — bold centred text, no fills ──────────────────────────────

function sectionHead(doc, label, y) {
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(10)
     .text(label, MARGIN, y + 4, { width: CW, align: "center", lineBreak: false });
  return y + 22;
}

// ── Patient info grid — stroke-only borders ────────────────────────────────────

function drawPatientInfo(doc, session, startY) {
  let y = sectionHead(doc, "PATIENT INFORMATION", startY) + 2;

  const age    = calcAge(session.patient_dob);
  const ageSex = [age != null ? `${age} Yrs` : null, session.patient_gender]
                   .filter(Boolean).join(" / ") || "-";
  const code   = session.patient_id || "-";

  const rows = [
    [
      { label: "Patient Name",             value: session.patient_name || "-" },
      { label: "Age / Sex",                value: ageSex                      },
    ],
    [
      { label: "Received & Reported Date", value: fmtDate(session.test_date)  },
      { label: "Patient ID",               value: code                        },
    ],
    [
      { label: "Ref. By",                  value: "-"                         },
      { label: "Specimen",                 value: "-"                         },
    ],
  ];

  const RH  = 22;
  const C1W = 120;
  const C2W = 138;
  const C3W = 120;
  const C4W = CW - C1W - C2W - C3W;
  const totalH = rows.length * RH;
  const topY   = y;

  // Outer border
  doc.rect(MARGIN, topY, CW, totalH).strokeColor(BLACK).lineWidth(0.5).stroke();

  // Vertical column dividers — full height
  vline(doc, MARGIN + C1W,               topY, topY + totalH, 0.5, BLACK);
  vline(doc, MARGIN + C1W + C2W,         topY, topY + totalH, 0.5, BLACK);
  vline(doc, MARGIN + C1W + C2W + C3W,   topY, topY + totalH, 0.5, BLACK);

  rows.forEach((pair, ri) => {
    // Horizontal divider between rows (not before first)
    if (ri > 0) {
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y)
         .strokeColor(BLACK).lineWidth(0.5).stroke();
    }

    let x = MARGIN;

    // Label 1 — bold
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8.5)
       .text(pair[0].label, x + 5, y + 7, { width: C1W - 8, lineBreak: false });
    x += C1W;

    // Value 1
    doc.fillColor(BLACK).font("Helvetica").fontSize(8.5)
       .text(pair[0].value, x + 5, y + 7, { width: C2W - 8, lineBreak: false });
    x += C2W;

    // Label 2 — bold
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8.5)
       .text(pair[1].label, x + 5, y + 7, { width: C3W - 8, lineBreak: false });
    x += C3W;

    // Value 2
    doc.fillColor(BLACK).font("Helvetica").fontSize(8.5)
       .text(pair[1].value, x + 5, y + 7, { width: C4W - 8, lineBreak: false });

    y += RH;
  });

  return y + 8;
}

// ── Results table — stroke-only borders, optional result colouring ─────────────
// colorResults=true  → red/green/orange for result values (session report)
// colorResults=false → plain black for all text (bulk / date-range report)

function drawResultsTable(doc, results, startY, patientGender, colorResults = true) {
  let y = sectionHead(doc, "LABORATORY TEST RESULTS", startY) + 2;

  const COLS = [155, 95, 160, 105]; // Test | Result | Bio Reference | Method — sum = 515 = CW
  const HDRS = ["Test", "Result Value", "Biological Reference", "Method"];
  const RH   = 28; // taller rows so wrapped method text stays within the cell

  // ── Header row ──────────────────────────────────────────────────────────────
  doc.rect(MARGIN, y, CW, RH).strokeColor(BLACK).lineWidth(0.5).stroke();

  let hx = MARGIN;
  HDRS.forEach((h, i) => {
    if (i > 0) vline(doc, hx, y, y + RH, 0.5, BLACK);
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
       .text(h, hx + 5, y + 9, { width: COLS[i] - 10, align: "center", lineBreak: false });
    hx += COLS[i];
  });
  y += RH;

  // ── Data rows ───────────────────────────────────────────────────────────────
  results.forEach((r) => {
    const status     = statusFor(r, patientGender);
    const unit       = sanitize(r.test_type_unit || r.unit || "");
    const rawVal     = r.value_text != null
      ? r.value_text
      : (r.value_num != null ? String(r.value_num) : "-");
    // Qualitative results (Positive/Negative) never get a unit appended
    const resDisplay = (r.value_text != null || !unit) ? rawVal : `${rawVal} ${unit}`;
    const resColor   = colorResults && status ? statusColor(status) : BLACK;

    // Row border (draw before text so borders don't overdraw text)
    doc.rect(MARGIN, y, CW, RH).strokeColor(BLACK).lineWidth(0.3).stroke();

    // Draw all vertical dividers upfront
    let divX = MARGIN;
    COLS.forEach((w, i) => {
      divX += w;
      if (i < COLS.length - 1) vline(doc, divX, y, y + RH, 0.3, BLACK);
    });

    const isBold = colorResults && status && status !== "NORMAL" && status !== "NEGATIVE";

    let cx = MARGIN;

    // Col 0 — Test name (left-aligned, single line)
    doc.fillColor(BLACK).font("Helvetica").fontSize(9)
       .text(r.test_type_name || "-", cx + 5, y + 9,
         { width: COLS[0] - 10, align: "left", lineBreak: false });
    cx += COLS[0];

    // Col 1 — Result value (centred, bold+colour when abnormal)
    doc.fillColor(resColor).font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
       .text(resDisplay, cx + 5, y + 9,
         { width: COLS[1] - 10, align: "center", lineBreak: false });
    cx += COLS[1];

    // Col 2 — Biological reference (centred, single line)
    doc.fillColor(GRAY).font("Helvetica").fontSize(9)
       .text(bioReference(r, patientGender), cx + 5, y + 9,
         { width: COLS[2] - 10, align: "center", lineBreak: false });
    cx += COLS[2];

    // Col 3 — Method (centred, allow line wrapping — top-aligned within cell)
    doc.fillColor(GRAY).font("Helvetica").fontSize(8.5)
       .text(methodCell(r), cx + 5, y + 6,
         { width: COLS[3] - 10, align: "center" });

    y += RH;
  });

  return y;
}

// ── Footer disclaimer ──────────────────────────────────────────────────────────

function drawFooter(doc, y) {
  y += 12;
  hline(doc, y, 1, BLACK);
  y += 8;

  const lines = [
    "Suggested Clinical correlation is advised.",
    "Test items relate only to the item tested.",
    "No part of this report can be reproduced without permission of the administrator.",
  ];

  lines.forEach((line) => {
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
       .text(line, MARGIN, y, { width: CW, lineBreak: false });
    y += 13;
  });

  y += 4;
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
     .text("THIS IS A SYSTEM GENERATED REPORT", MARGIN, y,
       { width: CW, align: "center", lineBreak: false });

  return y + 14;
}

// ── Page number ────────────────────────────────────────────────────────────────

function stampPageNum(doc, pageNum, totalPages) {
  const py = PAGE_H - 18;
  doc.fillColor(GRAY).font("Helvetica").fontSize(7.5)
     .text(`Page ${pageNum} of ${totalPages}`, MARGIN, py,
       { width: CW, align: "right", lineBreak: false });
}

// ── Exported generators ────────────────────────────────────────────────────────

/**
 * Session report — per-session, result values colour-coded.
 * @param {object} session - from getTestSessionFlat
 * @returns {Promise<Buffer>}
 */
export function generateSessionReportPdf(session) {
  return new Promise((resolve, reject) => {
    const orgName  = session.org_name        || "EDHAA Diagnostic";
    const deptName = session.department_name || "";
    const results  = session.results         || [];

    const doc = new PDFDocument({ margin: 0, autoFirstPage: false, size: "A4" });
    const buffers = [];
    doc.on("data",  (b) => buffers.push(b));
    doc.on("end",   () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.addPage();

    let y = drawHeader(doc, orgName, deptName);
    y = drawPatientInfo(doc, session, y);
    y += 4;
    y = drawResultsTable(doc, results, y, session.patient_gender, true);
    drawFooter(doc, y);
    stampPageNum(doc, 1, 1);

    doc.end();
  });
}

/**
 * Bulk tabular report — all sessions in a date range, no result colouring.
 * @param {Array}  histories - from getResultsForCsvExport (Sequelize instances)
 * @param {object} meta      - { orgName, deptName, startDate, endDate, performerLabel }
 * @returns {Promise<Buffer>}
 */
export function generateBulkReportPdf(histories, meta = {}) {
  return new Promise((resolve, reject) => {
    const orgName   = meta.orgName  || "EDHAA Diagnostic";
    const deptName  = meta.deptName || "";
    const label     = meta.startDate && meta.endDate
      ? `${meta.startDate}  to  ${meta.endDate}`
      : "All dates";
    const performer = meta.performerLabel || "";

    // Flatten histories → one row per test result
    const rows = [];
    for (const hist of histories) {
      const h  = typeof hist.get === "function" ? hist.get({ plain: true }) : hist;
      const p  = h.patient   || {};
      const eb = h.enteredBy || {};
      const results  = h.results || [];
      const dateStr  = fmtDate(h.test_date);
      const patientLabel = p.name
        ? `${p.name}${p.patient_id ? " #" + p.patient_id : ""}`
        : "-";
      const genderStr = (p.gender || "").charAt(0).toUpperCase() || "-";

      for (const res of results) {
        const tt      = res.testType || {};
        const unit    = sanitize(tt.unit || "");
        const rawVal  = res.value_text != null
          ? res.value_text
          : (res.value_num != null ? String(res.value_num) : "-");
        // Qualitative results never get a unit appended
        const resDisplay = (res.value_text != null || !unit) ? rawVal : `${rawVal} ${unit}`;

        const flatR = {
          is_qualitative: tt.is_qualitative,
          value_text:     res.value_text,
          value_num:      res.value_num,
          normal_min: tt.normal_min, normal_max: tt.normal_max,
          male_min:   tt.male_min,   male_max:   tt.male_max,
          female_min: tt.female_min, female_max: tt.female_max,
        };
        const status    = statusFor(flatR, p.gender);
        const methodStr = methodCell({
          specimen_type: tt.specimen_type,
          method_used:   res.method_used,
          method:        tt.method,
        });

        rows.push({
          dateStr, patientLabel, genderStr,
          testName: tt.name || "-",
          resDisplay, status: status || "-",
          methodStr,
        });
      }
    }

    // ── Layout ──────────────────────────────────────────────────────────────────
    const COLS = [60, 115, 115, 78, 52, 95]; // Date | Patient | Test | Result | Status | Method = 515
    const HDRS = ["Date", "Patient", "Test", "Result", "Status", "Method"];
    const RH   = 24; // taller rows so wrapped method text stays within the cell

    const doc = new PDFDocument({ margin: 0, autoFirstPage: false, size: "A4" });
    const buffers = [];
    doc.on("data",  (b) => buffers.push(b));
    doc.on("end",   () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    let pageNum    = 0;
    const totalRows = rows.length;

    const addPage = () => {
      doc.addPage();
      pageNum++;
      let y = MARGIN;

      // Org name — plain bold centred
      doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(14)
         .text(orgName, MARGIN, y, { width: CW, align: "center", lineBreak: false });
      y += 20;

      if (deptName) {
        doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
           .text(`DEPARTMENT OF ${deptName.toUpperCase()}`, MARGIN, y,
             { width: CW, align: "center", lineBreak: false });
        y += 14;
      }

      // Report period sub-line
      const subtitle = [
        performer || null,
        `Report Period: ${label}`,
        `Total Results: ${totalRows}`,
      ].filter(Boolean).join("   |   ");
      doc.fillColor(GRAY).font("Helvetica").fontSize(8)
         .text(subtitle, MARGIN, y, { width: CW, align: "center", lineBreak: false });
      y += 14;

      hline(doc, y, 1, BLACK);
      y += 8;

      // Table header row — stroke-only, bold text
      doc.rect(MARGIN, y, CW, RH).strokeColor(BLACK).lineWidth(0.5).stroke();
      let hx = MARGIN;
      HDRS.forEach((h, i) => {
        if (i > 0) vline(doc, hx, y, y + RH, 0.5, BLACK);
        doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8)
           .text(h, hx + 4, y + 8, { width: COLS[i] - 8, align: "center", lineBreak: false });
        hx += COLS[i];
      });
      y += RH;
      return y;
    };

    let y = addPage();
    const USABLE_H = PAGE_H - MARGIN - 30;

    rows.forEach((row, idx) => {
      if (y + RH > USABLE_H) {
        stampPageNum(doc, pageNum, "?");
        y = addPage();
      }

      // Row border — stroke only, no fill
      doc.rect(MARGIN, y, CW, RH).strokeColor(BLACK).lineWidth(0.25).stroke();

      // Draw all vertical dividers upfront so they don't overdraw text
      let dvx = MARGIN;
      COLS.forEach((w, i) => {
        dvx += w;
        if (i < COLS.length - 1) vline(doc, dvx, y, y + RH, 0.25, BLACK);
      });

      // All text in bulk report uses plain black — no status colouring
      const cells = [
        { text: row.dateStr,      color: BLACK, align: "center", wrap: false },
        { text: row.patientLabel, color: BLACK, align: "left",   wrap: false },
        { text: row.testName,     color: BLACK, align: "left",   wrap: false },
        { text: row.resDisplay,   color: BLACK, align: "center", wrap: false },
        { text: row.status,       color: BLACK, align: "center", wrap: false },
        { text: row.methodStr,    color: GRAY,  align: "center", wrap: true  },
      ];

      let cx = MARGIN;
      cells.forEach((cell, i) => {
        const textY = cell.wrap ? y + 5 : y + 8;
        const opts  = cell.wrap
          ? { width: COLS[i] - 8, align: cell.align }
          : { width: COLS[i] - 8, align: cell.align, lineBreak: false };
        doc.fillColor(cell.color).font("Helvetica").fontSize(8)
           .text(cell.text, cx + 4, textY, opts);
        cx += COLS[i];
      });

      y += RH;
    });

    if (rows.length === 0) {
      doc.fillColor(GRAY).font("Helvetica").fontSize(10)
         .text("No test results found for the selected date range.", MARGIN, y + 20,
           { width: CW, align: "center", lineBreak: false });
    }

    stampPageNum(doc, pageNum, pageNum);
    doc.end();
  });
}

/**
 * Single-result report — wraps generateSessionReportPdf with colour-coded values.
 * @param {object} result - from getTestResultByIdFlat
 * @returns {Promise<Buffer>}
 */
export function generateTestReportPdf(result) {
  const session = {
    org_name:        result.org_name,
    department_name: result.department_name,
    patient_name:    result.patient_name,
    patient_gender:  result.patient_gender,
    patient_dob:     result.patient_dob,
    patient_phone:   result.patient_phone,
    patient_email:   result.patient_email,
    patient_id:      result.patient_id,
    test_date:       result.test_date,
    device_id:       result.device_id,
    notes:           result.notes,
    entered_by_name: result.entered_by_name,
    results: [{
      test_type_name:  result.test_type_name,
      test_type_unit:  result.test_type_unit,
      value_num:       result.value_num,
      value_text:      result.value_text,
      normal_min:      result.normal_min,
      normal_max:      result.normal_max,
      male_min:        result.male_min,
      male_max:        result.male_max,
      female_min:      result.female_min,
      female_max:      result.female_max,
      reference_text:  result.reference_text,
      critical_low:    result.critical_low,
      critical_high:   result.critical_high,
      is_qualitative:  result.is_qualitative,
      method_used:     result.method_used,
      method:          result.method,
      specimen_type:   result.specimen_type,   // ← fixed: was missing, broke methodCell()
    }],
  };
  return generateSessionReportPdf(session);
}
