import PDFDocument from "pdfkit";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CW     = PAGE_W - 2 * MARGIN; // 515.28

const BLACK  = "#000000";
const GRAY   = "#555555";
const BORDER = "#000000";

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

function bioReference(r) {
  const unit = r.test_type_unit || r.unit || "";
  if (r.normal_min != null && r.normal_max != null)
    return `${r.normal_min} - ${r.normal_max}${unit ? " " + unit : ""}`;
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

// ── Drawing helpers ────────────────────────────────────────────────────────────

function hline(doc, y, lw = 0.5) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CW, y)
     .strokeColor(BORDER).lineWidth(lw).stroke();
}

// ── Header ─────────────────────────────────────────────────────────────────────

function drawHeader(doc, orgName, deptName) {
  // Org name
  doc.y = MARGIN;
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(18)
     .text(orgName, MARGIN, MARGIN, { width: CW, align: "center", lineBreak: false });

  let y = MARGIN + 26;
  hline(doc, y, 1);
  y += 5;

  // Department line — plain bold text, centered
  if (deptName) {
    doc.y = y;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(10)
       .text(`DEPARTMENT OF ${deptName.toUpperCase()}`, MARGIN, y,
         { width: CW, align: "center", lineBreak: false });
    y += 18;
  }

  hline(doc, y, 1);
  return y + 10;
}

// ── Section heading ────────────────────────────────────────────────────────────

function sectionHead(doc, label, y) {
  // Just bold underlined text — no colored background
  doc.y = y;
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
     .text(label, MARGIN, y, { width: CW, lineBreak: false });
  const lineY = y + 13;
  hline(doc, lineY, 0.5);
  return lineY + 3;
}

// ── Patient info grid ──────────────────────────────────────────────────────────

function drawPatientInfo(doc, session, startY) {
  let y = sectionHead(doc, "PATIENT INFORMATION", startY) + 2;

  const age    = calcAge(session.patient_dob);
  const ageSex = [age != null ? `${age} Yrs` : null, session.patient_gender]
                   .filter(Boolean).join(" / ") || "-";
  const code   = session.patient_code != null
    ? String(session.patient_code).padStart(5, "0")
    : "-";

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

  const RH  = 20;
  const C1W = 110; // label 1
  const C2W = 148; // value 1
  const C3W = 110; // label 2
  const C4W = CW - C1W - C2W - C3W; // value 2

  rows.forEach((pair) => {
    let x = MARGIN;

    // Outer row border
    doc.rect(MARGIN, y, CW, RH).strokeColor(BORDER).lineWidth(0.5).stroke();

    // Column dividers
    doc.moveTo(MARGIN + C1W,           y).lineTo(MARGIN + C1W,           y + RH).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveTo(MARGIN + C1W + C2W,     y).lineTo(MARGIN + C1W + C2W,     y + RH).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveTo(MARGIN + C1W + C2W + C3W, y).lineTo(MARGIN + C1W + C2W + C3W, y + RH).strokeColor(BORDER).lineWidth(0.5).stroke();

    // Left label
    doc.y = y;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8.5)
       .text(pair[0].label, x + 5, y + 6, { width: C1W - 8, lineBreak: false });
    x += C1W;

    // Left value
    doc.y = y;
    doc.fillColor(BLACK).font("Helvetica").fontSize(8.5)
       .text(pair[0].value, x + 5, y + 6, { width: C2W - 8, lineBreak: false });
    x += C2W;

    // Right label
    doc.y = y;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(8.5)
       .text(pair[1].label, x + 5, y + 6, { width: C3W - 8, lineBreak: false });
    x += C3W;

    // Right value
    doc.y = y;
    doc.fillColor(BLACK).font("Helvetica").fontSize(8.5)
       .text(pair[1].value, x + 5, y + 6, { width: C4W - 8, lineBreak: false });

    y += RH;
  });

  return y + 8;
}

// ── Results table ──────────────────────────────────────────────────────────────

function drawResultsTable(doc, results, startY) {
  let y = sectionHead(doc, "LABORATORY TEST RESULTS", startY) + 2;

  const COLS = [160, 100, 165, 90]; // sum = 515 = CW
  const HDRS = ["Parameter", "Result Value", "Biological Reference", "Method"];
  const RH   = 20;

  // Header row — bold text on white, full border
  let cx = MARGIN;
  doc.rect(MARGIN, y, CW, RH).strokeColor(BORDER).lineWidth(0.5).stroke();
  HDRS.forEach((h, i) => {
    if (i > 0) {
      doc.moveTo(cx, y).lineTo(cx, y + RH).strokeColor(BORDER).lineWidth(0.5).stroke();
    }
    doc.y = y;
    doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
       .text(h, cx + 5, y + 6, { width: COLS[i] - 10, align: "center", lineBreak: false });
    cx += COLS[i];
  });
  y += RH;

  // Data rows
  results.forEach((r) => {
    const status  = statusFor(r);
    const unit    = r.test_type_unit || r.unit || "";
    const resVal  = r.value_text
      ? r.value_text
      : (r.value_num != null ? String(r.value_num) : "-");
    const resDisplay  = unit ? `${resVal} ${unit}` : resVal;
    const isAbnormal  = status && status !== "NORMAL" && status !== "NEGATIVE";
    // Abnormal values shown in bold; no color change — plain black
    const resBold = isAbnormal;

    const cells = [
      { text: r.test_type_name || "-", bold: false, align: "left"   },
      { text: resDisplay,              bold: resBold, align: "center" },
      { text: bioReference(r),         bold: false, align: "center" },
      { text: "-",                     bold: false, align: "center" },
    ];

    cx = MARGIN;
    doc.rect(MARGIN, y, CW, RH).strokeColor(BORDER).lineWidth(0.5).stroke();
    cells.forEach((cell, i) => {
      if (i > 0) {
        doc.moveTo(cx, y).lineTo(cx, y + RH).strokeColor(BORDER).lineWidth(0.5).stroke();
      }
      doc.y = y;
      doc.fillColor(BLACK)
         .font(cell.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
         .text(cell.text, cx + 5, y + 6,
           { width: COLS[i] - 10, align: cell.align, lineBreak: false });
      cx += COLS[i];
    });
    y += RH;
  });

  return y;
}

// ── Footer disclaimer ──────────────────────────────────────────────────────────

function drawFooter(doc, y) {
  y += 12;
  hline(doc, y, 0.5);
  y += 8;

  const lines = [
    "Suggested Clinical correlation is advised.",
    "Test items relate only to the item tested.",
    "No part of this report can be reproduced without permission of the administrator.",
  ];

  lines.forEach((line) => {
    doc.y = y;
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
       .text(line, MARGIN, y, { width: CW, lineBreak: false });
    y += 13;
  });

  y += 4;
  doc.y = y;
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
     .text("THIS IS A SYSTEM GENERATED REPORT", MARGIN, y,
       { width: CW, align: "center", lineBreak: false });

  return y + 14;
}

// ── Page number ────────────────────────────────────────────────────────────────

function stampPageNum(doc, pageNum, totalPages) {
  const py = PAGE_H - 18;
  doc.y = py;
  doc.fillColor(GRAY).font("Helvetica").fontSize(7.5)
     .text(`Page ${pageNum} of ${totalPages}`, MARGIN, py,
       { width: CW, align: "right", lineBreak: false });
}

// ── Exported generators ────────────────────────────────────────────────────────

/**
 * Session report — single page, plain layout.
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
    y = drawResultsTable(doc, results, y);
    drawFooter(doc, y);
    stampPageNum(doc, 1, 1);

    doc.end();
  });
}

/**
 * Single-result report.
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
    patient_code:    result.patient_code,
    test_date:       result.test_date,
    device_id:       result.device_id,
    notes:           result.notes,
    entered_by_name: result.entered_by_name,
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
