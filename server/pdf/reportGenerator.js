import PDFDocument from "pdfkit";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CW = PAGE_W - 2 * MARGIN; // 515.28

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GRAY = "#666666";

// Result status colours — the ONLY colours used; only in session/single-test reports
const COLOR_NORMAL = "#11865B";  // green  — normal / positive
const COLOR_HIGH = "#B42318";  // red    — high / negative
const COLOR_LOW = "#A05A00";  // orange — low

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
    g === "MALE" && r.male_min != null ? Number(r.male_min) :
      g === "FEMALE" && r.female_min != null ? Number(r.female_min) :
        r.normal_min != null ? Number(r.normal_min) : null;
  const max =
    g === "MALE" && r.male_max != null ? Number(r.male_max) :
      g === "FEMALE" && r.female_max != null ? Number(r.female_max) :
        r.normal_max != null ? Number(r.normal_max) : null;

  if (min != null && max != null) {
    if (v < min) return "LOW";
    if (v > max) return "HIGH";
    return "NORMAL";
  }
  if (min == null && max != null) return v > max ? "HIGH" : "NORMAL";
  if (min != null && max == null) return v < min ? "LOW" : "NORMAL";
  return null;
}

function statusColor(status) {
  if (status === "HIGH" || status === "NEGATIVE") return COLOR_HIGH;
  if (status === "LOW") return COLOR_LOW;
  if (status === "NORMAL" || status === "POSITIVE") return COLOR_NORMAL;
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
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
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
  return method || "-";
}

function bioReference(r, gender) {
  if (r.reference_text) {
    const lines = r.reference_text.split("\n").map(l => l.trim()).filter(Boolean);
    const g = (gender || "").toUpperCase();
    // Try to find a gender-specific line first
    if (g && lines.length > 1) {
      const genderLine = lines.find(l => l.toUpperCase().startsWith(g));
      if (genderLine) {
        const cleaned = genderLine.replace(/^(Male|Female)\s*:\s*/i, "").trim();
        if (cleaned) return sanitize(cleaned);
      }
    }
    // Fallback: first line, strip any gender prefix
    let firstLine = lines[0] || "";
    firstLine = firstLine.replace(/^(Male|Female)\s*:\s*/i, "").trim();
    if (firstLine) return sanitize(firstLine);
  }
  const g = (gender || "").toUpperCase();
  const min =
    g === "MALE" && r.male_min != null ? Number(r.male_min) :
      g === "FEMALE" && r.female_min != null ? Number(r.female_min) :
        r.normal_min != null ? Number(r.normal_min) : null;
  const max =
    g === "MALE" && r.male_max != null ? Number(r.male_max) :
      g === "FEMALE" && r.female_max != null ? Number(r.female_max) :
        r.normal_max != null ? Number(r.normal_max) : null;
  if (min != null && max != null) return `${min} - ${max}`;
  if (min == null && max != null) return `< ${max}`;
  if (min != null && max == null) return `> ${min}`;
  return "-";
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
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

const COMPANY_NAME = "EDHAA INNOVATIONS PRIVATE LIMITED";
const COMPANY_ADDRESS = "6008, 6TH FLOOR, RBTIC BUILDING, IIT BOMBAY, POWAI, MUMBAI, 400076";

function drawHeader(doc) {
  let y = MARGIN;

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(16)
    .text(COMPANY_NAME, MARGIN, y, { width: CW, align: "center", lineBreak: false });
  y += 22;

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
    .text(COMPANY_ADDRESS, MARGIN, y, { width: CW, align: "center", lineBreak: false });
  y += 16;

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

  const patientCode = session.patient_id || "-";
  const sampleCode = session.sample_id || "-";

  const age =
    session.patient_age ||
    session.age ||
    calcAge(session.patient_dob) ||
    "-";

  const gender =
    session.patient_gender ||
    session.gender ||
    "-";

  const registeredDate =
    `${fmtDate(session.created_at || session.registered_at || session.test_date)} ${fmtTime(session.created_at || session.registered_at || session.test_date)}`;

  const reportedDate =
    `${fmtDate(session.test_date)} ${fmtTime(session.test_date)}`;

const rows = [
  [
    { label: "Sample ID", value: sampleCode },
    { label: "Reported Date & Time", value: reportedDate },
  ],
  [
    { label: "Patient ID", value: patientCode },
    { label: "Ref. By.", value: session.org_name || "-" },
  ],
  [
    { label: "Age / Gender", value: `${age} / ${gender}` },
    { label: "Registered Date & Time", value: registeredDate },
  ],
];

  const RH = 22;
  const C1W = 120;
  const C2W = 138;
  const C3W = 120;
  const C4W = CW - C1W - C2W - C3W;
  const totalH = rows.length * RH;
  const topY = y;

  // Outer border
  doc.rect(MARGIN, topY, CW, totalH).strokeColor(BLACK).lineWidth(0.5).stroke();

  // Vertical column dividers — full height
  vline(doc, MARGIN + C1W, topY, topY + totalH, 0.5, BLACK);
  vline(doc, MARGIN + C1W + C2W, topY, topY + totalH, 0.5, BLACK);
  vline(doc, MARGIN + C1W + C2W + C3W, topY, topY + totalH, 0.5, BLACK);

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

  // Column sequence: Test Name | Value | Unit | Range | Method
  const COLS = [140, 85, 60, 120, 110];
  const HDRS = ["Test Name", "Observed Value", "Unit", "Biological Reference", "Method"];
  const RH = 28; // taller rows so wrapped method text stays within the cell

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
    const status = statusFor(r, patientGender);
    const unit = sanitize(r.test_type_unit || r.unit || "");
    const rawVal = r.value_text != null
      ? r.value_text
      : (r.value_num != null ? String(r.value_num) : "-");
    const resColor = colorResults && status ? statusColor(status) : BLACK;

    // Row border (draw before text so borders don't overdraw text)
    doc.rect(MARGIN, y, CW, RH).strokeColor(BLACK).lineWidth(0.3).stroke();

    // Draw all vertical dividers upfront
    let divX = MARGIN;
    COLS.forEach((w, i) => {
      divX += w;
      if (i < COLS.length - 1) vline(doc, divX, y, y + RH, 0.3, BLACK);
    });

    const isBold = colorResults && status && status !== "NORMAL" && status !== "POSITIVE";

    let cx = MARGIN;

    // Col 0 — Test Name: show full_name 
    const testLabel = r.test_full_name || r.test_type_name || "-";

    doc.fillColor(BLACK).font("Helvetica").fontSize(9)
      .text(testLabel, cx + 5, y + 9,
        { width: COLS[0] - 10, align: "center", lineBreak: false });
    cx += COLS[0];

    // Col 1 — Unit (centred)
    // doc.fillColor(GRAY).font("Helvetica").fontSize(9)
    //   .text(unit || "-", cx + 5, y + 9,
    //     { width: COLS[1] - 10, align: "center", lineBreak: false });
    // cx += COLS[1];

    // // Col 2 — Value (centred, bold+colour when abnormal)
    // doc.fillColor(resColor).font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
    //   .text(rawVal, cx + 5, y + 9,
    //     { width: COLS[2] - 10, align: "center", lineBreak: false });
    // cx += COLS[2];

    // Col 1 — Value
    doc.fillColor(resColor).font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
      .text(rawVal, cx + 5, y + 9,
        { width: COLS[1] - 10, align: "center", lineBreak: false });
    cx += COLS[1];

    // Col 2 — Unit
    doc.fillColor(GRAY).font("Helvetica").fontSize(9)
      .text(unit || "-", cx + 5, y + 9,
        { width: COLS[2] - 10, align: "center", lineBreak: false });
    cx += COLS[2];

    // Col 3 — Range (centred, single line)
    doc.fillColor(GRAY).font("Helvetica").fontSize(9)
      .text(bioReference(r, patientGender), cx + 5, y + 9,
        { width: COLS[3] - 10, align: "center", lineBreak: false });
    cx += COLS[3];

    // Col 4 — Method (centred, allow line wrapping — top-aligned within cell)
    doc.fillColor(GRAY).font("Helvetica").fontSize(8.5)
      .text(methodCell(r), cx + 5, y + 6,
        { width: COLS[4] - 10, align: "center" });

    y += RH;
  });

  return y;
}

// ── Footer disclaimer ──────────────────────────────────────────────────────────

function drawFooter(doc, y) {
  y += 12;
  hline(doc, y, 1, BLACK);
  y += 8;

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8)
    .text("Disclaimer:", MARGIN, y, { width: CW, lineBreak: false });
  y += 13;

  const lines = [
    "1. This report has been generated as part of a pilot study and is strictly confidential. It must not be disclosed to patients or any unauthorized parties without clinical approval.",
    "2. Reproduction, distribution, or disclosure of this report, in whole or in part, is strictly prohibited without prior written permission from the administration.",
    "3. Biological reference/Normal ranges presented herein are derived from a limited sample set tested during prior pilot study.",
  ];

  lines.forEach((line) => {
    doc.fillColor(GRAY).font("Helvetica").fontSize(7.5)
      .text(line, MARGIN + 4, y, { width: CW - 4 });
    y = doc.y + 2;
  });

  y += 6;
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
    const orgName = session.org_name || "EDHAA Diagnostic";
    const deptName = session.department_name || "";
    const results = session.results || [];

    const doc = new PDFDocument({ margin: 0, autoFirstPage: false, size: "A4" });
    const buffers = [];
    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.addPage();

    let y = drawHeader(doc);
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
    const orgName = meta.orgName || "EDHAA Diagnostic";
    const orgAddress = meta.orgAddress || "";
    const deptName = meta.deptName || "";
    const label = meta.startDate && meta.endDate
      ? `${meta.startDate}  to  ${meta.endDate}`
      : "All dates";
    const performer = meta.performerLabel || "";

    // Flatten histories → one row per test result
    const rows = [];
    for (const hist of histories) {
      const h = typeof hist.get === "function" ? hist.get({ plain: true }) : hist;
      const p = h.patient || {};
      const eb = h.enteredBy || {};
      const results = h.results || [];
      const dateStr = fmtDate(h.test_date);
      const patientLabel = p.name
        ? `${p.patient_id}`
        : "-";
      const genderStr = (p.gender || "").charAt(0).toUpperCase() || "-";

      for (const res of results) {
        const tt = res.testType || {};
        const unit = sanitize(tt.unit || "");
        const rawVal = res.value_text != null
          ? res.value_text
          : (res.value_num != null ? String(res.value_num) : "-");
        // Qualitative results never get a unit appended
        const resDisplay = (res.value_text != null || !unit) ? rawVal : `${rawVal} ${unit}`;

        const flatR = {
          is_qualitative: tt.is_qualitative,
          value_text: res.value_text,
          value_num: res.value_num,
          normal_min: tt.normal_min, normal_max: tt.normal_max,
          male_min: tt.male_min, male_max: tt.male_max,
          female_min: tt.female_min, female_max: tt.female_max,
        };
        const status = statusFor(flatR, p.gender);
        const methodStr = methodCell({
          specimen_type: tt.specimen_type,
          method_used: res.method_used,
          method: tt.method,
        });

        rows.push({
          dateStr,
          patientLabel,
          genderStr,

          testName: tt.full_name || tt.name || "-",

          resultValue: rawVal,
          resultUnit: unit || "-",

          status: status || "-",
          methodStr,
        });
      }
    }

    // ── Layout ──────────────────────────────────────────────────────────────────
    const COLS = [50, 60, 35, 40, 110, 65, 55, 55];

    const HDRS = [
      "Date",
      "Patient ID",
      "Age",
      "Gender",
      "Test",
      "Result",
      "Unit",
      "Status",
    ];
    const RH = 24; // taller rows so wrapped method text stays within the cell

    const doc = new PDFDocument({ margin: 0, autoFirstPage: false, size: "A4" });
    const buffers = [];
    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    let pageNum = 0;
    const totalRows = rows.length;

    // const addPage = () => {
    //   doc.addPage();
    //   pageNum++;
    //   let y = MARGIN;

    //   // Org name — plain bold centred
    //   doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(14)
    //      .text(orgName, MARGIN, y, { width: CW, align: "center", lineBreak: false });
    //   y += 20;

    //   if (orgAddress) {
    //     doc.fillColor(GRAY).font("Helvetica").fontSize(9)
    //        .text(orgAddress, MARGIN, y, { width: CW, align: "center", lineBreak: false });
    //     y += 14;
    //   }

    //   if (deptName) {
    //     doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
    //        .text(`DEPARTMENT OF ${deptName.toUpperCase()}`, MARGIN, y,
    //          { width: CW, align: "center", lineBreak: false });
    //     y += 14;
    //   }

    //   // Report period sub-line
    //   const subtitle = [
    //     performer || null,
    //     `Report Period: ${label}`,
    //     `Total Results: ${totalRows}`,
    //   ].filter(Boolean).join("   |   ");
    //   doc.fillColor(GRAY).font("Helvetica").fontSize(8)
    //      .text(subtitle, MARGIN, y, { width: CW, align: "center", lineBreak: false });
    //   y += 14;

    //   hline(doc, y, 1, BLACK);
    //   y += 8;

    //   // Table header row — stroke-only, bold text
    //   doc.rect(MARGIN, y, CW, RH).strokeColor(BLACK).lineWidth(0.5).stroke();
    //   let hx = MARGIN;
    //   HDRS.forEach((h, i) => {
    //     if (i > 0) vline(doc, hx, y, y + RH, 0.5, BLACK);
    //     doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8)
    //        .text(h, hx + 4, y + 8, { width: COLS[i] - 8, align: "center", lineBreak: false });
    //     hx += COLS[i];
    //   });
    //   y += RH;
    //   return y;
    // };

    const addPage = () => {
      doc.addPage();
      pageNum++;

      // SAME HEADER AS PATIENT PDF
      let y = drawHeader(doc);

      // Report title
      doc.fillColor(BLACK)
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(orgName, MARGIN, y + 5, {
          width: CW,
          align: "center",
          lineBreak: false
        });

      y += 25;

      const subtitle = [
        performer || null,
        `Report Period: ${label}`,
        `Total Results: ${totalRows}`,
      ].filter(Boolean).join("   |   ");

      doc.fillColor(GRAY)
        .font("Helvetica")
        .fontSize(8)
        .text(subtitle, MARGIN, y, {
          width: CW,
          align: "center",
          lineBreak: false
        });

      y += 18;

      hline(doc, y, 1, BLACK);
      y += 8;

      // TABLE HEADER
      doc.rect(MARGIN, y, CW, RH)
        .strokeColor(BLACK)
        .lineWidth(0.5)
        .stroke();

      let hx = MARGIN;

      HDRS.forEach((h, i) => {
        if (i > 0) vline(doc, hx, y, y + RH, 0.5, BLACK);

        doc.fillColor(BLACK)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(h, hx + 4, y + 8, {
            width: COLS[i] - 8,
            align: "center",
            lineBreak: false
          });

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
        { text: row.dateStr, color: BLACK, align: "center", wrap: false },
        { text: row.patientLabel, color: BLACK, align: "center", wrap: false },
        { text: row.age || "-", color: BLACK, align: "center", wrap: false },
        { text: row.gender || "-", color: BLACK, align: "center", wrap: false },
        { text: row.testName, color: BLACK, align: "center", wrap: false },
        { text: row.resultValue, color: BLACK, align: "center", wrap: false },
        { text: row.resultUnit, color: BLACK, align: "center", wrap: false },
        { text: row.status, color: BLACK, align: "center", wrap: false },
      ];

      let cx = MARGIN;
      cells.forEach((cell, i) => {
        const textY = cell.wrap ? y + 5 : y + 8;
        const opts = cell.wrap
          ? { width: COLS[i], align: cell.align }
          : { width: COLS[i], align: cell.align, lineBreak: false };
        doc.fillColor(cell.color).font("Helvetica").fontSize(8)
          .text(cell.text, cx, textY, opts);
        cx += COLS[i];
      });

      y += RH;
    });

    if (rows.length === 0) {
      doc.fillColor(GRAY).font("Helvetica").fontSize(10)
        .text("No test results found for the selected date range.", MARGIN, y + 20,
          { width: CW, align: "center", lineBreak: false });
    }
    drawFooter(doc, y);
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
    org_name: result.org_name,
    department_name: result.department_name,
    sample_id: result.sample_id,
    patient_name: result.patient_name,
    patient_gender: result.patient_gender,
    patient_dob: result.patient_dob,
    patient_phone: result.patient_phone,
    patient_email: result.patient_email,
    patient_id: result.patient_id,
    test_date: result.test_date,
    device_id: result.device_id,
    notes: result.notes,
    entered_by_name: result.entered_by_name,
    results: [{
      test_type_name: result.test_type_name,
      test_full_name: result.test_full_name,
      test_type_unit: result.test_type_unit,
      value_num: result.value_num,
      value_text: result.value_text,
      normal_min: result.normal_min,
      normal_max: result.normal_max,
      male_min: result.male_min,
      male_max: result.male_max,
      female_min: result.female_min,
      female_max: result.female_max,
      reference_text: result.reference_text,
      critical_low: result.critical_low,
      critical_high: result.critical_high,
      is_qualitative: result.is_qualitative,
      method_used: result.method_used,
      method: result.method,
      specimen_type: result.specimen_type,   // ← fixed: was missing, broke methodCell()
    }],
  };
  return generateSessionReportPdf(session);
}


export function generateTodayPatientReportPdf({ patient, sessions, orgName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 0,
      autoFirstPage: false,
      size: "A4",
    });

    const buffers = [];

    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.addPage();

    let y = drawHeader(doc);

    const todaySession = {
      patient_id: patient.patient_id,
      sample_id: patient.sample_id || "-",
      org_name: patient.org_name || orgName || "-",
      test_date: new Date(),
    };

    y = drawPatientInfo(doc, todaySession, y);

    y += 4;

    const allResults = [];

    sessions.forEach((session) => {
      (session.results || []).forEach((result) => {
        const tt = result.testType || {};

        allResults.push({
          ...result,
          test_type_name: tt.name,
          test_full_name: tt.full_name,
          test_type_unit: tt.unit,
          normal_min: tt.normal_min,
          normal_max: tt.normal_max,
          male_min: tt.male_min,
          male_max: tt.male_max,
          female_min: tt.female_min,
          female_max: tt.female_max,
          reference_text: tt.reference_text,
          critical_low: tt.critical_low,
          critical_high: tt.critical_high,
          is_qualitative: tt.is_qualitative,
          method: tt.method,
          method_options: tt.method_options,
        });
      });
    });

    y = drawResultsTable(
      doc,
      allResults,
      y,
      patient.gender,
      true
    );

    drawFooter(doc, y);
    stampPageNum(doc, 1, 1);

    doc.end();
  });
}