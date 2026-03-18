import PDFDocument from "pdfkit";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_W  = 595.28;
const MARGIN  = 40;
const CW      = PAGE_W - 2 * MARGIN; // usable content width = 515.28

const C = {
  primary:    "#009268",
  dark:       "#006B4D",
  light:      "#E6F5F0",
  danger:     "#B42318",
  dangerBg:   "#FDECEC",
  warning:    "#A05A00",
  warningBg:  "#FFF4E5",
  success:    "#11865B",
  successBg:  "#E7F7EF",
  white:      "#FFFFFF",
  text:       "#111827",
  muted:      "#6B7280",
  labelBg:    "#F3F4F6",
  border:     "#D1D5DB",
  altRow:     "#F9FAFB",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusFor(r) {
  if (r.value_text) {
    const v = (r.value_text || "").toUpperCase();
    if (v === "POSITIVE") return "POSITIVE";
    if (v === "NEGATIVE") return "NEGATIVE";
    return r.value_text;
  }
  if (r.value_num == null) return null;
  const v   = Number(r.value_num);
  const min = r.normal_min != null ? Number(r.normal_min) : null;
  const max = r.normal_max != null ? Number(r.normal_max) : null;
  if (min != null && max != null) {
    if (v < min) return "LOW";
    if (v > max) return "HIGH";
    return "NORMAL";
  }
  return null;
}

function statusColors(status) {
  switch ((status || "").toUpperCase()) {
    case "HIGH":
    case "POSITIVE": return { fg: C.danger,  bg: C.dangerBg  };
    case "LOW":      return { fg: C.warning, bg: C.warningBg };
    case "NORMAL":
    case "NEGATIVE": return { fg: C.success, bg: C.successBg };
    default:         return { fg: C.muted,   bg: C.altRow    };
  }
}

function refRange(r) {
  const unit = r.test_type_unit || r.unit || "";
  if (r.normal_min != null && r.normal_max != null)
    return `${r.normal_min} – ${r.normal_max}${unit ? " " + unit : ""}`;
  return "—";
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

// ── Drawing primitives ─────────────────────────────────────────────────────────
//
// PDFKit moves its internal cursor after every doc.text() call. When the next
// text is drawn at a Y position that is LESS than the current cursor Y, PDFKit
// auto-inserts a new blank page. All multi-text draws on the same row therefore
// reset doc.y to the row's baseline before each text call.

/** Green top banner — returns banner height */
function banner(doc, orgName, deptName) {
  const h = deptName ? 78 : 60;
  doc.rect(0, 0, PAGE_W, h).fillColor(C.dark).fill();
  const orgY = deptName ? 14 : 20;
  doc.y = 0; // cursor starts at top of page
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(18)
     .text(orgName, MARGIN, orgY, { width: CW, align: "center", lineBreak: false });
  if (deptName) {
    doc.y = orgY; // reset before second text in banner
    doc.fillColor("#FFFFFFCC").font("Helvetica").fontSize(10)
       .text(deptName, MARGIN, 38, { width: CW, align: "center", lineBreak: false });
  }
  return h;
}

/** Green section heading bar — returns new Y */
function sectionHead(doc, label, y) {
  doc.rect(MARGIN, y, CW, 22).fillColor(C.primary).fill();
  doc.y = y;
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(10)
     .text(label, MARGIN + 8, y + 6, { width: CW - 16, lineBreak: false });
  return y + 22;
}

/** 2-column info table (label | value). Returns new Y. */
function infoTable(doc, rows, y) {
  const LW = 130;
  const VW = CW - LW;
  const RH = 22;
  rows.forEach((row, i) => {
    const rowBg = i % 2 === 0 ? C.white : C.altRow;
    // label cell
    doc.rect(MARGIN, y, LW, RH).fillColor(C.labelBg).fill();
    doc.rect(MARGIN, y, LW, RH).strokeColor(C.border).lineWidth(0.5).stroke();
    doc.y = y; // reset cursor before label
    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9)
       .text(row.label, MARGIN + 6, y + 7, { width: LW - 10, lineBreak: false });
    // value cell — reset cursor so y+7 is not behind current cursor
    doc.rect(MARGIN + LW, y, VW, RH).fillColor(rowBg).fill();
    doc.rect(MARGIN + LW, y, VW, RH).strokeColor(C.border).lineWidth(0.5).stroke();
    doc.y = y; // reset before value
    doc.fillColor(row.highlight ? row.highlightColor || C.text : C.text)
       .font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
       .text(String(row.value || "—"), MARGIN + LW + 6, y + 7, { width: VW - 10, lineBreak: false });
    y += RH;
  });
  return y;
}

/**
 * Summary results table.
 * Columns: No. | Test Name | Result | Unit | Ref Range | Status
 */
function summaryTable(doc, results, y) {
  const COLS = [28, 130, 72, 52, 120, 70];
  const HDRS = ["No.", "Test Name", "Result", "Unit", "Ref Range", "Status"];
  const RH   = 22;

  // header row
  let cx = MARGIN;
  HDRS.forEach((h, i) => {
    doc.rect(cx, y, COLS[i], RH).fillColor(C.primary).fill();
    doc.rect(cx, y, COLS[i], RH).strokeColor(C.dark).lineWidth(0.5).stroke();
    doc.y = y; // reset before each header cell
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(9)
       .text(h, cx + 4, y + 7, { width: COLS[i] - 8, align: "center", lineBreak: false });
    cx += COLS[i];
  });
  y += RH;

  results.forEach((r, idx) => {
    const status  = statusFor(r);
    const sc      = statusColors(status);
    const rowBg   = idx % 2 === 0 ? C.white : C.altRow;
    const unit    = r.test_type_unit || r.unit || "—";
    const res     = r.value_text ? r.value_text : (r.value_num != null ? String(r.value_num) : "—");
    const range   = refRange(r);

    const cells = [
      { text: String(idx + 1), align: "center",  bg: rowBg },
      { text: r.test_type_name || "—", bold: true, bg: rowBg },
      { text: res,    align: "center", bold: true, bg: sc.bg, color: sc.fg },
      { text: unit,   align: "center", bg: rowBg },
      { text: range,  align: "center", bg: rowBg },
      { text: status || "—", align: "center", bold: true, bg: sc.bg, color: sc.fg },
    ];

    cx = MARGIN;
    cells.forEach((cell, i) => {
      doc.rect(cx, y, COLS[i], RH).fillColor(cell.bg || rowBg).fill();
      doc.rect(cx, y, COLS[i], RH).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.y = y; // reset before each cell text
      doc.fillColor(cell.color || C.text)
         .font(cell.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
         .text(String(cell.text || "—"), cx + 4, y + 7,
           { width: COLS[i] - 8, align: cell.align || "left", lineBreak: false });
      cx += COLS[i];
    });
    y += RH;
  });

  return y;
}

// ── Page builders ──────────────────────────────────────────────────────────────

/** Single test detail page */
function buildTestDetailPage(doc, session, result, testIndex, totalTests) {
  const orgName  = session.org_name        || "EDHAA Diagnostic";
  const deptName = session.department_name || "";
  const bannerH  = banner(doc, orgName, deptName);

  let y = bannerH + 14;

  // Title
  doc.y = bannerH;
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(13)
     .text(`TEST DETAIL  —  ${testIndex} of ${totalTests}`, MARGIN, y, { width: CW, align: "center", lineBreak: false });
  y += 20;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y).strokeColor(C.primary).lineWidth(1.5).stroke();
  y += 10;

  // Patient quick-info bar
  doc.rect(MARGIN, y, CW, 26).fillColor(C.light).fill();
  doc.rect(MARGIN, y, CW, 26).strokeColor(C.primary).lineWidth(0.5).stroke();
  doc.y = y;
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(9)
     .text(`Patient: ${session.patient_name || "—"}`, MARGIN + 8, y + 8, { width: 200, lineBreak: false });
  if (session.patient_phone) {
    doc.y = y;
    doc.text(`Phone: ${session.patient_phone}`, MARGIN + 220, y + 8, { width: 150, lineBreak: false });
  }
  doc.y = y;
  doc.text(`Date: ${fmtDate(session.test_date)}`, MARGIN + 380, y + 8, { width: 130, lineBreak: false });
  y += 36;

  // Test info section
  y = sectionHead(doc, "TEST INFORMATION", y) + 2;

  const status = statusFor(result);
  const sc     = statusColors(status);
  const unit   = result.test_type_unit || result.unit || "";
  const res    = result.value_text
    ? result.value_text
    : (result.value_num != null ? String(result.value_num) : "—");

  const detailRows = [
    { label: "Test Name",       value: result.test_type_name || "—",             bold: true },
    { label: "Result",          value: `${res}${unit ? " " + unit : ""}`,         bold: true, highlight: true, highlightColor: sc.fg },
    { label: "Reference Range", value: refRange(result) },
    { label: "Unit",            value: unit || "—" },
    { label: "Status",          value: status || "—",                             bold: true, highlight: !!status, highlightColor: sc.fg },
  ];

  infoTable(doc, detailRows, y);
}

/** Page 1 — Cover with full patient + session info */
function buildCoverPage(doc, session) {
  const orgName  = session.org_name        || "EDHAA Diagnostic";
  const deptName = session.department_name || "";
  const bannerH  = banner(doc, orgName, deptName);

  // Report title
  let y = bannerH + 16;
  doc.y = bannerH;
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(15)
     .text("DIAGNOSTIC TEST REPORT", MARGIN, y, { width: CW, align: "center", lineBreak: false });
  y += 22;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y).strokeColor(C.primary).lineWidth(1.5).stroke();
  y += 14;

  // Patient information
  y = sectionHead(doc, "PATIENT INFORMATION", y) + 2;
  const patientRows = [
    { label: "Full Name",     value: session.patient_name,          bold: true },
    { label: "Gender",        value: session.patient_gender                    },
    { label: "Date of Birth", value: fmtDate(session.patient_dob)              },
  ];
  if (session.patient_phone) patientRows.push({ label: "Phone", value: session.patient_phone });
  if (session.patient_email) patientRows.push({ label: "Email", value: session.patient_email });
  y = infoTable(doc, patientRows, y) + 14;

  // Session information
  y = sectionHead(doc, "SESSION INFORMATION", y) + 2;
  const sessionRows = [
    { label: "Test Date", value: fmtDate(session.test_date) },
  ];
  if (session.device_id) sessionRows.push({ label: "Device ID", value: session.device_id });
  if (session.notes)     sessionRows.push({ label: "Notes",     value: session.notes     });
  y = infoTable(doc, sessionRows, y) + 14;

  // Recorded by
  y = sectionHead(doc, "RECORDED BY", y) + 2;
  infoTable(doc, [
    { label: "Technician", value: `${session.entered_by_name || "—"} (${session.entered_by_username || "—"})`, bold: true },
  ], y);
}

/** Page 2 — Summary table of all tests */
function buildSummaryPage(doc, session) {
  const orgName  = session.org_name        || "EDHAA Diagnostic";
  const deptName = session.department_name || "";
  const bannerH  = banner(doc, orgName, deptName);

  let y = bannerH + 14;

  // Title
  doc.y = bannerH;
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(13)
     .text("TEST RESULTS SUMMARY", MARGIN, y, { width: CW, align: "center", lineBreak: false });
  y += 20;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y).strokeColor(C.primary).lineWidth(1.5).stroke();
  y += 10;

  // Patient quick-info bar — three texts on same row, reset cursor before each
  doc.rect(MARGIN, y, CW, 26).fillColor(C.light).fill();
  doc.rect(MARGIN, y, CW, 26).strokeColor(C.primary).lineWidth(0.5).stroke();
  doc.y = y;
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(9)
     .text(`Patient: ${session.patient_name || "—"}`, MARGIN + 8, y + 8, { width: 200, lineBreak: false });
  if (session.patient_phone) {
    doc.y = y;
    doc.text(`Phone: ${session.patient_phone}`, MARGIN + 220, y + 8, { width: 150, lineBreak: false });
  }
  doc.y = y;
  doc.text(`Date: ${fmtDate(session.test_date)}`, MARGIN + 380, y + 8, { width: 130, lineBreak: false });
  y += 36;

  // Summary table
  summaryTable(doc, session.results || [], y);
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function pageFooter(doc, orgName, pageNum, totalPages) {
  const footerY = doc.page.height - 30;
  doc.moveTo(MARGIN, footerY - 4).lineTo(MARGIN + CW, footerY - 4)
     .strokeColor(C.border).lineWidth(0.5).stroke();
  doc.fillColor(C.muted).font("Helvetica").fontSize(8)
     .text(
       `Generated on ${new Date().toLocaleString("en-IN")} — ${orgName}`,
       MARGIN, footerY,
       { width: CW / 2, align: "left", lineBreak: false }
     );
  doc.y = footerY; // reset before right-side text to prevent blank page
  doc.text(`Page ${pageNum} of ${totalPages}`, MARGIN + CW / 2, footerY,
    { width: CW / 2, align: "right", lineBreak: false });
}

// ── Exported generators ────────────────────────────────────────────────────────

/**
 * Session report: cover page + summary page.
 * @param {object} session - from getTestSessionFlat
 * @returns {Promise<Buffer>}
 */
export function generateSessionReportPdf(session) {
  return new Promise((resolve, reject) => {
    const orgName  = session.org_name || "EDHAA Diagnostic";
    const results  = session.results || [];
    const totalPages = 2 + results.length;

    // margin: 0 ensures cursor starts at (0,0) after addPage().
    // With margin > 0 the cursor starts at (margin, margin) and any text drawn
    // at y < margin (e.g. the banner at y=14) triggers an unwanted blank page.
    const doc = new PDFDocument({ margin: 0, autoFirstPage: false, size: "A4" });
    const buffers = [];
    doc.on("data",  (b) => buffers.push(b));
    doc.on("end",   () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Page 1: Cover
    doc.addPage();
    buildCoverPage(doc, session);
    pageFooter(doc, orgName, 1, totalPages);

    // Page 2: Summary
    doc.addPage();
    buildSummaryPage(doc, session);
    pageFooter(doc, orgName, 2, totalPages);

    // Pages 3+: One detail page per test result
    results.forEach((result, idx) => {
      doc.addPage();
      buildTestDetailPage(doc, session, result, idx + 1, results.length);
      pageFooter(doc, orgName, 3 + idx, totalPages);
    });

    doc.end();
  });
}

/**
 * Single-result report (cover + summary of 1 result).
 * @param {object} result - from getTestResultByIdFlat
 * @returns {Promise<Buffer>}
 */
export function generateTestReportPdf(result) {
  const session = {
    org_name:            result.org_name,
    department_name:     result.department_name,
    patient_name:        result.patient_name,
    patient_gender:      result.patient_gender,
    patient_dob:         result.patient_dob,
    patient_phone:       result.patient_phone,
    patient_email:       result.patient_email,
    test_date:           result.test_date,
    device_id:           result.device_id,
    notes:               result.notes,
    entered_by_name:     result.entered_by_name,
    entered_by_username: result.entered_by_username,
    results: [{
      test_type_name: result.test_type_name,
      test_type_unit: result.test_type_unit,
      value_num:      result.value_num,
      value_text:     result.value_text,
      normal_min:     result.normal_min,
      normal_max:     result.normal_max,
    }],
  };
  return generateSessionReportPdf(session);
}
