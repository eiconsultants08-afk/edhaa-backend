/**
 * Full demo seed — showcases all EDHHA app features.
 *
 * Fully self-contained — works on a blank DB (new dev machine) or existing one.
 * Edit SEED_CONFIG near the top to configure org/dept/admin for your environment.
 *
 * Creates / upserts:
 *   1 organisation — from SEED_CONFIG.org (created if not found by code slug)
 *   1 department   — from SEED_CONFIG.dept (created if not found by name)
 *   1 real admin   — from SEED_CONFIG.realAdmin (created if missing; password always reset)
 *
 * Then wipes and recreates all org-scoped demo data:
 *   3 technicians  — tech.raj (most active), tech.priya, tech.meena (least active)
 *   3 devices      — DEV-001 & DEV-002 assigned; DEV-003 unassigned
 *   20 patients    — mixed demographics
 *   34 test types  — 31 BIO-CHEQ numeric + 3 qualitative (from device_ref_data.csv)
 *   ~300–450 sessions over 90 days
 *     • Last 7 days : 5–7/day, ~20% PENDING (shows pending workflow)
 *     • Days 8–30   : 3–5/day, all COMPLETED
 *     • Days 31–90  : 2–4/day, all COMPLETED
 *
 * Run:  node server/seed.js
 *        (no arguments needed — configure SEED_CONFIG for your environment)
 *
 * All accounts password: Demo@1234
 */

import "./secret/secrets.js";
import sequelize from "./database/connectdb.js";
import "./database/associations.js";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

import Users              from "./database/users.js";
import Organization       from "./database/organization.js";
import Department         from "./database/department.js";
import Patients           from "./database/patients.js";
import Devices            from "./database/devices.js";
import TestTypes          from "./database/test_types.js";
import TestHistory        from "./database/test_history.js";
import PatientTestResults from "./database/patient_test_results.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const rnd   = (min, max) => Math.random() * (max - min) + min;
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const round = (n, d = 2) => parseFloat(n.toFixed(d));

function pastDate(daysAgo, hourOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(8 + hourOffset + Math.floor(rnd(0, 1)), Math.floor(rnd(0, 60)), 0, 0);
  return d;
}

function weightedPick(arr, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i];
    if (r < acc) return arr[i];
  }
  return arr[arr.length - 1];
}

async function nextval(seqName) {
  const rows = await sequelize.query(
    `SELECT nextval('${seqName}')::int AS val`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return rows[0].val;
}

// ── Demo environment configuration ───────────────────────────────────────────
// Edit this block when setting up on a new machine. The seed will create
// everything from scratch if it doesn't exist, or reuse what's already there.

const SEED_CONFIG = {
  org: {
    org_name: "EIPL Diagnostics",        // Organisation display name
    code:     "EIPL01",                  // Short unique slug (TEXT, unique in DB)
    address:  "Mumbai, Maharashtra",
    phone:    "9800000000",
    email:    "info@eipl.com",
  },
  dept: {
    department_name: "General Diagnostics",
  },
  realAdmin: {
    name:     "EIPL Admin",
    username: "admin.eipl",
    email:    "admin@eipl.com",
    phone:    "9800000001",
    // password is always reset to Demo@1234 on every seed run
  },
};

// ── Patient pool (20 patients) ────────────────────────────────────────────────

const PATIENT_POOL = [
  { name: "Arjun Sharma",        gender: "MALE",   dob: "1980-04-12", phone: "9810011001", email: "arjun.sharma@mail.com"    },
  { name: "Preethi Nair",        gender: "FEMALE", dob: "1993-07-25", phone: "9810011002", email: "preethi.nair@mail.com"    },
  { name: "Mohammed Rafi",       gender: "MALE",   dob: "1975-11-03", phone: "9810011003", email: "mohammed.rafi@mail.com"   },
  { name: "Sunita Devi",         gender: "FEMALE", dob: "1988-02-18", phone: "9810011004", email: "sunita.devi@mail.com"     },
  { name: "Vikram Patel",        gender: "MALE",   dob: "1965-09-30", phone: "9810011005", email: "vikram.patel@mail.com"    },
  { name: "Lakshmi Rao",         gender: "FEMALE", dob: "1971-06-14", phone: "9810011006", email: "lakshmi.rao@mail.com"     },
  { name: "Deepak Verma",        gender: "MALE",   dob: "1995-01-22", phone: "9810011007", email: "deepak.verma@mail.com"    },
  { name: "Anjali Gupta",        gender: "FEMALE", dob: "1990-08-09", phone: "9810011008", email: "anjali.gupta@mail.com"    },
  { name: "Suresh Kumar",        gender: "MALE",   dob: "1958-12-05", phone: "9810011009", email: "suresh.kumar@mail.com"    },
  { name: "Rekha Menon",         gender: "FEMALE", dob: "1983-03-27", phone: "9810011010", email: "rekha.menon@mail.com"     },
  { name: "Rajesh Bose",         gender: "MALE",   dob: "1970-10-16", phone: "9810011011", email: "rajesh.bose@mail.com"     },
  { name: "Kavitha Pillai",      gender: "FEMALE", dob: "1997-05-01", phone: "9810011012", email: "kavitha.pillai@mail.com"  },
  { name: "Anil Khanna",         gender: "MALE",   dob: "1962-07-19", phone: "9810011013", email: "anil.khanna@mail.com"     },
  { name: "Divya Reddy",         gender: "FEMALE", dob: "1986-11-11", phone: "9810011014", email: "divya.reddy@mail.com"     },
  { name: "Sanjay Mishra",       gender: "MALE",   dob: "1978-04-07", phone: "9810011015", email: "sanjay.mishra@mail.com"   },
  { name: "Meera Krishnan",      gender: "FEMALE", dob: "1969-08-22", phone: "9810011016", email: "meera.krishnan@mail.com"  },
  { name: "Rahul Tiwari",        gender: "MALE",   dob: "1991-03-15", phone: "9810011017", email: "rahul.tiwari@mail.com"    },
  { name: "Pooja Bhatt",         gender: "FEMALE", dob: "1984-12-30", phone: "9810011018", email: "pooja.bhatt@mail.com"     },
  { name: "Karthik Subramaniam", gender: "MALE",   dob: "1973-06-08", phone: "9810011019", email: "karthik.sub@mail.com"     },
  { name: "Nandita Singh",       gender: "FEMALE", dob: "1999-01-19", phone: "9810011020", email: "nandita.singh@mail.com"   },
];

// ── BIO-CHEQ test type definitions (31 numeric + 3 qualitative) ──────────────
//
// method_options: array of valid methods for this test.
//   - Single item → readonly in UI
//   - Multiple    → dropdown in UI
//   - null        → Calculated (no method picker)
//
// genValue(gender): generates a realistic seeding value.
//   - "MALE" or "FEMALE" as arg; ignored for gender-neutral tests.

const TEST_TYPE_DEFS = [
  // ── 1. Haemoglobin ─────────────────────────────────────────────────────────
  {
    name: "Hb", full_name: "Haemoglobin", unit: "g/dL",
    category: "Haemogram biochemistry",
    method_options: ["Alkaline Hematin D Method"],
    reference_text: "Male: 14 - 18 g/dL\nFemale: 12 - 16 g/dL",
    normal_min: 12,   normal_max: 18,
    male_min:   14,   male_max:   18,
    female_min: 12,   female_max: 16,
    critical_low: 7,  critical_high: 20,
    genValue: (gender) => {
      const lo = gender === "FEMALE" ? 12   : 14;
      const hi = gender === "FEMALE" ? 16   : 18;
      return Math.random() < 0.25
        ? round(rnd(7.5, lo - 0.5))
        : round(rnd(lo + 0.2, hi));
    },
  },

  // ── 2. Random Blood Glucose ─────────────────────────────────────────────────
  {
    name: "RBS", full_name: "Random Blood Glucose", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["GOD-POD Method"],
    reference_text: "Diabetes mellitus: > 200 mg/dL",
    normal_min: 70,   normal_max: 140,
    male_min:   70,   male_max:   140,
    female_min: 70,   female_max: 140,
    critical_low: 60, critical_high: 300,
    genValue: () => Math.random() < 0.38
      ? round(rnd(200, 290))
      : round(rnd(72, 139)),
  },

  // ── 3. Serum Creatinine ─────────────────────────────────────────────────────
  {
    name: "S. Creatinine", full_name: "Serum Creatinine", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Modified Jaffe Method"],
    reference_text: "Male: 0.66 - 1.25 mg/dL\nFemale: 0.52 - 1.04 mg/dL",
    normal_min: 0.52, normal_max: 1.25,
    male_min:   0.66, male_max:   1.25,
    female_min: 0.52, female_max: 1.04,
    critical_low: null, critical_high: 5,
    genValue: (gender) => {
      const lo = gender === "FEMALE" ? 0.52 : 0.66;
      const hi = gender === "FEMALE" ? 1.04 : 1.25;
      return Math.random() < 0.20
        ? round(rnd(1.3, 4.5))
        : round(rnd(lo, hi));
    },
  },

  // ── 4. eGFR ─────────────────────────────────────────────────────────────────
  {
    name: "eGFR", full_name: "Estimated Glomerular Filtration Rate", unit: "-",
    category: "Calculated",
    method_options: null,
    reference_text: "Normal: >=90\nMild Decrease: 60-89\nMild to Moderate Decrease: 45-59\nModerate to Severe Decrease: 30-44\nSevere Decrease: 15-29\nKidney Failure: <15",
    normal_min: 90,   normal_max: null,
    male_min:   90,   male_max:   null,
    female_min: 90,   female_max: null,
    critical_low: 15, critical_high: null,
    genValue: () => {
      const r = Math.random();
      if (r < 0.10) return round(rnd(15, 44), 0);    // severely reduced
      if (r < 0.28) return round(rnd(45, 89), 0);    // mildly/moderately reduced
      return round(rnd(90, 140), 0);                  // normal
    },
  },

  // ── 5. Serum Urea ───────────────────────────────────────────────────────────
  {
    name: "S. Urea", full_name: "Serum Urea", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Berthlot Endpoint Method"],
    reference_text: "Male: 19 - 43 mg/dL\nFemale: 20 - 36 mg/dL",
    normal_min: 19,   normal_max: 43,
    male_min:   19,   male_max:   43,
    female_min: 20,   female_max: 36,
    critical_low: null, critical_high: 100,
    genValue: (gender) => {
      const hi = gender === "FEMALE" ? 36 : 43;
      return Math.random() < 0.18
        ? round(rnd(hi + 5, 95))
        : round(rnd(20, hi));
    },
  },

  // ── 6. Serum Uric Acid ──────────────────────────────────────────────────────
  {
    name: "S. Uric Acid", full_name: "Serum Uric Acid", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Uricase-POD Method"],
    reference_text: "Male: 3.5 - 8.5 mg/dL\nFemale: 2.5 - 6.2 mg/dL",
    normal_min: 2.5,  normal_max: 8.5,
    male_min:   3.5,  male_max:   8.5,
    female_min: 2.5,  female_max: 6.2,
    critical_low: null, critical_high: 13,
    genValue: (gender) => {
      const max = gender === "FEMALE" ? 6.2 : 8.5;
      const min = gender === "FEMALE" ? 2.5 : 3.5;
      return Math.random() < 0.25
        ? round(rnd(max + 0.4, 12))
        : round(rnd(min, max));
    },
  },

  // ── 7. Blood Urea Nitrogen ──────────────────────────────────────────────────
  {
    name: "BUN", full_name: "Blood Urea Nitrogen", unit: "mg/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "6 - 20 mg/dL",
    normal_min: 6,    normal_max: 20,
    male_min:   6,    male_max:   20,
    female_min: 6,    female_max: 20,
    critical_low: null, critical_high: 50,
    genValue: () => Math.random() < 0.18
      ? round(rnd(21, 48))
      : round(rnd(7, 19)),
  },

  // ── 8. Total Bilirubin ──────────────────────────────────────────────────────
  {
    name: "S. Total Bilirubin", full_name: "Total Bilirubin", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Diazo Method"],
    reference_text: "0 - 1.2 mg/dL",
    normal_min: 0,    normal_max: 1.2,
    male_min:   0,    male_max:   1.2,
    female_min: 0,    female_max: 1.2,
    critical_low: null, critical_high: 15,
    genValue: () => Math.random() < 0.20
      ? round(rnd(1.3, 12))
      : round(rnd(0.2, 1.15)),
  },

  // ── 9. Direct Bilirubin ─────────────────────────────────────────────────────
  {
    name: "S. Direct Bilirubin", full_name: "Direct Bilirubin", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Diazo Method"],
    reference_text: "0 - 0.3 mg/dL",
    normal_min: 0,    normal_max: 0.3,
    male_min:   0,    male_max:   0.3,
    female_min: 0,    female_max: 0.3,
    critical_low: null, critical_high: 5,
    genValue: () => Math.random() < 0.18
      ? round(rnd(0.35, 4.5))
      : round(rnd(0.05, 0.28)),
  },

  // ── 10. Indirect Bilirubin ──────────────────────────────────────────────────
  {
    name: "Indirect Bilirubin", full_name: "Indirect Bilirubin", unit: "mg/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "0 - 1.0 mg/dL",
    normal_min: 0,    normal_max: 1.0,
    male_min:   0,    male_max:   1.0,
    female_min: 0,    female_max: 1.0,
    critical_low: null, critical_high: null,
    genValue: () => Math.random() < 0.18
      ? round(rnd(1.05, 4))
      : round(rnd(0.1, 0.95)),
  },

  // ── 11. Serum Albumin ───────────────────────────────────────────────────────
  {
    name: "S. Albumin", full_name: "Serum Albumin", unit: "g/dL",
    category: "Serum Biochemistry",
    method_options: ["Bromocresol Green Method"],
    reference_text: "3.5 - 5.2 g/dL",
    normal_min: 3.5,  normal_max: 5.2,
    male_min:   3.5,  male_max:   5.2,
    female_min: 3.5,  female_max: 5.2,
    critical_low: 2,  critical_high: null,
    genValue: () => Math.random() < 0.15
      ? round(rnd(2.1, 3.4))
      : round(rnd(3.6, 5.1)),
  },

  // ── 12. Serum Total Protein ─────────────────────────────────────────────────
  {
    name: "S. TP", full_name: "Serum Total Protein", unit: "g/dL",
    category: "Serum Biochemistry",
    method_options: ["Biuret Method"],
    reference_text: "6.0 - 8.30 g/dL",
    normal_min: 6.0,  normal_max: 8.3,
    male_min:   6.0,  male_max:   8.3,
    female_min: 6.0,  female_max: 8.3,
    critical_low: 4,  critical_high: 10,
    genValue: () => {
      const r = Math.random();
      if (r < 0.08) return round(rnd(4.1, 5.9));
      if (r < 0.15) return round(rnd(8.4, 9.8));
      return round(rnd(6.1, 8.2));
    },
  },

  // ── 13. Serum Globulin ──────────────────────────────────────────────────────
  {
    name: "S. Globulin", full_name: "Serum Globulin", unit: "g/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "1.8 - 3.6 g/dL",
    normal_min: 1.8,  normal_max: 3.6,
    male_min:   1.8,  male_max:   3.6,
    female_min: 1.8,  female_max: 3.6,
    critical_low: null, critical_high: null,
    genValue: () => Math.random() < 0.12
      ? round(rnd(3.7, 5.5))
      : round(rnd(1.9, 3.5)),
  },

  // ── 14. A/G Ratio ───────────────────────────────────────────────────────────
  {
    name: "S. A/G Ratio", full_name: "Serum Albumin to Globulin Ratio", unit: "-",
    category: "Calculated",
    method_options: null,
    reference_text: "0.9 - 2",
    normal_min: 0.9,  normal_max: 2.0,
    male_min:   0.9,  male_max:   2.0,
    female_min: 0.9,  female_max: 2.0,
    critical_low: null, critical_high: null,
    genValue: () => Math.random() < 0.15
      ? round(rnd(0.5, 0.88))
      : round(rnd(0.92, 1.98)),
  },

  // ── 15. Serum Calcium ───────────────────────────────────────────────────────
  {
    name: "S. Calcium", full_name: "Serum Calcium", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Arsenazo III Method"],
    reference_text: "8.4 - 10.2 mg/dL",
    normal_min: 8.4,  normal_max: 10.2,
    male_min:   8.4,  male_max:   10.2,
    female_min: 8.4,  female_max: 10.2,
    critical_low: 6.5, critical_high: 13,
    genValue: () => {
      const r = Math.random();
      if (r < 0.07) return round(rnd(6.6, 8.3));
      if (r < 0.12) return round(rnd(10.3, 12.5));
      return round(rnd(8.5, 10.1));
    },
  },

  // ── 16. Serum Total Cholesterol ─────────────────────────────────────────────
  {
    name: "S. TC", full_name: "Serum Total Cholesterol", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["CHOD-POD Method"],
    reference_text: "Desirable: < 200 mg/dL\nBorderline High: 200-239 mg/dL\nHigh: >=240 mg/dL",
    normal_min: 0,    normal_max: 200,
    male_min:   0,    male_max:   200,
    female_min: 0,    female_max: 200,
    critical_low: null, critical_high: 300,
    genValue: () => {
      const r = Math.random();
      if (r < 0.18) return round(rnd(240, 295));
      if (r < 0.35) return round(rnd(200, 239));
      return round(rnd(140, 198));
    },
  },

  // ── 17. Serum Triglycerides ─────────────────────────────────────────────────
  {
    name: "S. Triglycerides", full_name: "Serum Triglycerides", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["GPO-POD Method"],
    reference_text: "Normal: < 150 mg/dL\nBorderline High: 150-199 mg/dL\nHigh: 200-499 mg/dL\nVery High: >=500 mg/dL",
    normal_min: 0,    normal_max: 150,
    male_min:   0,    male_max:   150,
    female_min: 0,    female_max: 150,
    critical_low: null, critical_high: 500,
    genValue: () => {
      const r = Math.random();
      if (r < 0.12) return round(rnd(200, 490));
      if (r < 0.28) return round(rnd(150, 199));
      return round(rnd(60, 148));
    },
  },

  // ── 18. Serum HDL Cholesterol ───────────────────────────────────────────────
  {
    name: "S. HDL-C", full_name: "Serum HDL Cholesterol", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Polymer-Detergent Method"],
    reference_text: "> 40 mg/dL",
    normal_min: 40,   normal_max: null,
    male_min:   40,   male_max:   null,
    female_min: 40,   female_max: null,
    critical_low: 20, critical_high: null,
    genValue: () => Math.random() < 0.28
      ? round(rnd(21, 39))
      : round(rnd(41, 85)),
  },

  // ── 19. Serum Non HDL Cholesterol ──────────────────────────────────────────
  {
    name: "S. Non HDL-C", full_name: "Serum Non HDL Cholesterol", unit: "mg/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "Optimal: < 130 mg/dL\nDesirable: 130-159 mg/dL\nBorderline High: 159-189 mg/dL\nHigh: 189-220 mg/dL\nVery High: >=220 mg/dL",
    normal_min: 0,    normal_max: 130,
    male_min:   0,    male_max:   130,
    female_min: 0,    female_max: 130,
    critical_low: null, critical_high: null,
    genValue: () => {
      const r = Math.random();
      if (r < 0.20) return round(rnd(189, 250));
      if (r < 0.38) return round(rnd(130, 188));
      return round(rnd(60, 128));
    },
  },

  // ── 20. Serum LDL Cholesterol ───────────────────────────────────────────────
  {
    name: "S. LDL-C", full_name: "Serum LDL Cholesterol", unit: "mg/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "Optimal: < 100 mg/dL\nNear Optimal: 100-129 mg/dL\nBorderline High: 130-159 mg/dL\nHigh: 160-189 mg/dL\nVery High: >=190 mg/dL",
    normal_min: 0,    normal_max: 100,
    male_min:   0,    male_max:   100,
    female_min: 0,    female_max: 100,
    critical_low: null, critical_high: 190,
    genValue: () => {
      const r = Math.random();
      if (r < 0.15) return round(rnd(160, 195));
      if (r < 0.35) return round(rnd(100, 159));
      return round(rnd(45, 98));
    },
  },

  // ── 21. Serum VLDL Cholesterol ──────────────────────────────────────────────
  {
    name: "S. VLDL-C", full_name: "Serum VLDL Cholesterol", unit: "mg/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "6 - 38 mg/dL",
    normal_min: 6,    normal_max: 38,
    male_min:   6,    male_max:   38,
    female_min: 6,    female_max: 38,
    critical_low: null, critical_high: null,
    genValue: () => Math.random() < 0.18
      ? round(rnd(39, 70))
      : round(rnd(7, 37)),
  },

  // ── 22. LDL/HDL Ratio ───────────────────────────────────────────────────────
  {
    name: "S. LDL/HDL Ratio", full_name: "Serum LDL/HDL Ratio", unit: "-",
    category: "Calculated",
    method_options: null,
    reference_text: "2.5 - 3.5",
    normal_min: 2.5,  normal_max: 3.5,
    male_min:   2.5,  male_max:   3.5,
    female_min: 2.5,  female_max: 3.5,
    critical_low: null, critical_high: null,
    genValue: () => {
      const r = Math.random();
      if (r < 0.20) return round(rnd(3.6, 5.5));
      if (r < 0.30) return round(rnd(1.5, 2.4));
      return round(rnd(2.5, 3.5));
    },
  },

  // ── 23. TC/HDL Ratio ────────────────────────────────────────────────────────
  {
    name: "S. Cholesterol / HDL Ratio", full_name: "Serum TC/HDL Ratio", unit: "-",
    category: "Calculated",
    method_options: null,
    reference_text: "3.5 - 5",
    normal_min: 3.5,  normal_max: 5.0,
    male_min:   3.5,  male_max:   5.0,
    female_min: 3.5,  female_max: 5.0,
    critical_low: null, critical_high: null,
    genValue: () => {
      const r = Math.random();
      if (r < 0.22) return round(rnd(5.1, 8));
      if (r < 0.30) return round(rnd(2.0, 3.4));
      return round(rnd(3.5, 5.0));
    },
  },

  // ── 24. HbA1C ───────────────────────────────────────────────────────────────
  {
    name: "HbA1C", full_name: "Glycated Hemoglobin", unit: "%",
    category: "Serum Biochemistry",
    method_options: ["Immunoturbidimetric Method"],
    reference_text: "Non-diabetic: <=5.6 %\nPre-diabetic: 5.7 - 6.4 %\nDiabetic: >=6.5 %\n\nExcellent Control: 6-7 %\nFair to Good Control: 7 to 8%\nUnsatisfactory Control: 8 to 10 %\nPoor Control: More than 10 %",
    normal_min: 0,    normal_max: 5.6,
    male_min:   0,    male_max:   5.6,
    female_min: 0,    female_max: 5.6,
    critical_low: null, critical_high: null,
    genValue: () => {
      const r = Math.random();
      if (r < 0.22) return round(rnd(6.5, 10.5), 1);
      if (r < 0.38) return round(rnd(5.7, 6.4), 1);
      return round(rnd(4.5, 5.6), 1);
    },
  },

  // ── 25. eAG ─────────────────────────────────────────────────────────────────
  {
    name: "eAG", full_name: "Estimated Average Glucose", unit: "mg/dL",
    category: "Calculated",
    method_options: null,
    reference_text: "Good Control: 90-120 mg/dL\nFair Control: 121-150 mg/dL\nUnsatisfactory Control: 151-180 mg/dL\nPoor Control: >180 mg/dL",
    normal_min: 90,   normal_max: 120,
    male_min:   90,   male_max:   120,
    female_min: 90,   female_max: 120,
    critical_low: null, critical_high: null,
    genValue: () => {
      const r = Math.random();
      if (r < 0.22) return round(rnd(180, 280));
      if (r < 0.40) return round(rnd(121, 179));
      return round(rnd(91, 120));
    },
  },

  // ── 26. Serum Sodium ────────────────────────────────────────────────────────
  {
    name: "S. Sodium", full_name: "Serum Sodium", unit: "mmol/L",
    category: "Serum Biochemistry",
    method_options: ["Colorimetric Method"],
    reference_text: "136 - 145 mmol/L",
    normal_min: 136,  normal_max: 145,
    male_min:   136,  male_max:   145,
    female_min: 136,  female_max: 145,
    critical_low: 120, critical_high: 160,
    genValue: () => {
      const r = Math.random();
      if (r < 0.06) return round(rnd(121, 135), 0);
      if (r < 0.10) return round(rnd(146, 158), 0);
      return round(rnd(137, 144), 0);
    },
  },

  // ── 27. Serum Potassium ─────────────────────────────────────────────────────
  {
    name: "S. Potassium", full_name: "Serum Potassium", unit: "mmol/L",
    category: "Serum Biochemistry",
    method_options: ["Colorimetric Method"],
    reference_text: "3.5 - 5.1 mmol/L",
    normal_min: 3.5,  normal_max: 5.1,
    male_min:   3.5,  male_max:   5.1,
    female_min: 3.5,  female_max: 5.1,
    critical_low: 2.5, critical_high: 6.5,
    genValue: () => {
      const r = Math.random();
      if (r < 0.08) return round(rnd(2.6, 3.4), 1);
      if (r < 0.14) return round(rnd(5.2, 6.4), 1);
      return round(rnd(3.6, 5.0), 1);
    },
  },

  // ── 28. Serum Chloride ──────────────────────────────────────────────────────
  {
    name: "S. Chloride", full_name: "Serum Chloride", unit: "mmol/L",
    category: "Serum Biochemistry",
    method_options: ["Thiocyanate Method"],
    reference_text: "98 - 109 mmol/L",
    normal_min: 98,   normal_max: 109,
    male_min:   98,   male_max:   109,
    female_min: 98,   female_max: 109,
    critical_low: 80, critical_high: 115,
    genValue: () => {
      const r = Math.random();
      if (r < 0.06) return round(rnd(81, 97), 0);
      if (r < 0.10) return round(rnd(110, 114), 0);
      return round(rnd(99, 108), 0);
    },
  },

  // ── 29. Serum Magnesium ─────────────────────────────────────────────────────
  {
    name: "S. Magnesium", full_name: "Serum Magnesium", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Xylidyl Blue Method"],
    reference_text: "1.6 - 3.0 mg/dL",
    normal_min: 1.6,  normal_max: 3.0,
    male_min:   1.6,  male_max:   3.0,
    female_min: 1.6,  female_max: 3.0,
    critical_low: 1.0, critical_high: 4.0,
    genValue: () => {
      const r = Math.random();
      if (r < 0.08) return round(rnd(1.1, 1.59));
      if (r < 0.12) return round(rnd(3.1, 3.9));
      return round(rnd(1.65, 2.95));
    },
  },

  // ── 30. Serum Phosphorus ────────────────────────────────────────────────────
  {
    name: "S. Phosphorus", full_name: "Serum Phosphorus", unit: "mg/dL",
    category: "Serum Biochemistry",
    method_options: ["Ammonium Molybdate Method"],
    reference_text: "2.5 - 4.5 mg/dL",
    normal_min: 2.5,  normal_max: 4.5,
    male_min:   2.5,  male_max:   4.5,
    female_min: 2.5,  female_max: 4.5,
    critical_low: 1.0, critical_high: 7.0,
    genValue: () => {
      const r = Math.random();
      if (r < 0.08) return round(rnd(1.1, 2.4));
      if (r < 0.13) return round(rnd(4.6, 6.8));
      return round(rnd(2.6, 4.4));
    },
  },

  // ── 31. Serum Zinc ──────────────────────────────────────────────────────────
  {
    name: "S. Zinc", full_name: "Serum Zinc", unit: "µg/dL",
    category: "Serum Biochemistry",
    method_options: ["Bromo PAPS Method"],
    reference_text: "60 - 120 µg/dL",
    normal_min: 60,   normal_max: 120,
    male_min:   60,   male_max:   120,
    female_min: 60,   female_max: 120,
    critical_low: null, critical_high: null,
    genValue: () => Math.random() < 0.20
      ? round(rnd(30, 59))
      : round(rnd(62, 118)),
  },

  // ── 32. Urine Cotinine (qualitative) ────────────────────────────────────────
  {
    name: "U. Cotinine", full_name: "Urine Cotinine", unit: "Positive/Negative",
    category: "Urine test",
    method_options: ["LFA Test Cards"],
    reference_text: "Negative",
    normal_min: null, normal_max: null,
    male_min:   null, male_max:   null,
    female_min: null, female_max: null,
    critical_low: null, critical_high: null,
    is_qualitative: true,
    genValue: () => Math.random() < 0.18 ? "POSITIVE" : "NEGATIVE",
  },

  // ── 33. HIV I & II (qualitative) ────────────────────────────────────────────
  {
    name: "S. HIV I & II", full_name: "Human Immunodeficiency Viruses I & II", unit: "Positive/Negative",
    category: "Serum infection test",
    method_options: null,
    reference_text: "Negative",
    normal_min: null, normal_max: null,
    male_min:   null, male_max:   null,
    female_min: null, female_max: null,
    critical_low: null, critical_high: null,
    is_qualitative: true,
    genValue: () => Math.random() < 0.05 ? "POSITIVE" : "NEGATIVE",
  },

  // ── 34. HBsAg (qualitative) ─────────────────────────────────────────────────
  {
    name: "S. HBsAg", full_name: "Hepatitis B Surface Antigen", unit: "Positive/Negative",
    category: "Serum infection test",
    method_options: null,
    reference_text: "Negative",
    normal_min: null, normal_max: null,
    male_min:   null, male_max:   null,
    female_min: null, female_max: null,
    critical_low: null, critical_high: null,
    is_qualitative: true,
    genValue: () => Math.random() < 0.08 ? "POSITIVE" : "NEGATIVE",
  },
];

// ── Test panels (groups of test names run together) ───────────────────────────
//
// Each panel = array of test names from TEST_TYPE_DEFS.
// A session will run 1–2 randomly selected panels (de-duped).

const PANELS = [
  // Kidney function
  ["S. Creatinine", "eGFR", "BUN", "S. Urea"],
  // Liver function
  ["S. Total Bilirubin", "S. Direct Bilirubin", "Indirect Bilirubin", "S. Albumin", "S. TP", "S. Globulin", "S. A/G Ratio"],
  // Lipid profile (full)
  ["S. TC", "S. Triglycerides", "S. HDL-C", "S. LDL-C", "S. VLDL-C", "S. Non HDL-C", "S. LDL/HDL Ratio", "S. Cholesterol / HDL Ratio"],
  // Diabetes
  ["RBS", "HbA1C", "eAG"],
  // Electrolytes
  ["S. Sodium", "S. Potassium", "S. Chloride"],
  // Minerals
  ["S. Calcium", "S. Magnesium", "S. Phosphorus", "S. Zinc"],
  // Haemoglobin standalone
  ["Hb"],
  // Uric acid + RBS quick check
  ["RBS", "S. Uric Acid"],
  // Infection screen
  ["S. HIV I & II", "S. HBsAg", "U. Cotinine"],
  // Thyroid + metabolic quick (reuse some types)
  ["RBS", "S. Creatinine", "S. Urea", "Hb"],
];

// ── Session notes pool ────────────────────────────────────────────────────────

const NOTES_POOL = [
  "Routine follow-up visit",
  "Pre-operative screening",
  "Annual health check",
  "Post-treatment monitoring",
  "Patient reported fatigue — full panel ordered",
  "Referred by Dr. Iyer for workup",
  "Diabetes management check",
  "Follow-up after medication change",
  "General wellness screening",
  "Camp patient — community health drive",
];

// ── Main ──────────────────────────────────────────────────────────────────────
//
// Usage:
//   node server/seed.js                              # auto-detect org from first ADMIN
//   node server/seed.js --org <uuid> --dept <uuid>   # explicit org/dept (new dev env)

async function seed() {
  await sequelize.authenticate();
  console.log("✅ DB connected\n");

  // ── 0. Ensure all extended columns and sequences exist ───────────────────
  // Safe to run multiple times — all DDL uses IF NOT EXISTS / IF EXISTS guards.
  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS patients_patient_code_seq START 1;`);
  await sequelize.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_code INTEGER;`);
  await sequelize.query(`ALTER TABLE patients ALTER COLUMN patient_code SET DEFAULT nextval('patients_patient_code_seq');`);

  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS organizations_org_code_seq START 1;`);
  await sequelize.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code INTEGER;`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN org_code SET DEFAULT nextval('organizations_org_code_seq');`);

  // test_types extended columns (BIO-CHEQ)
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS category TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS method_options JSONB;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS reference_text TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_low FLOAT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_high FLOAT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS is_qualitative BOOLEAN NOT NULL DEFAULT false;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS specimen_type TEXT;`);

  // patient_test_results.method_used
  await sequelize.query(`ALTER TABLE patient_test_results ADD COLUMN IF NOT EXISTS method_used TEXT;`);

  // test_histories.status enum
  await sequelize.query(`DO $$ BEGIN CREATE TYPE enum_test_history_status AS ENUM ('PENDING','COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await sequelize.query(`ALTER TABLE test_histories ADD COLUMN IF NOT EXISTS status enum_test_history_status NOT NULL DEFAULT 'PENDING';`);

  console.log("✅ Sequences & extended columns verified\n");

  // ── 1. Upsert org, department, and real admin ─────────────────────────────
  // Fully self-contained: works on a blank DB with no prior data.

  // 1a. Organisation — find by unique slug `code`, create if missing
  let org = await Organization.findOne({ where: { code: SEED_CONFIG.org.code }, raw: true });
  if (!org) {
    console.log(`🏢 Creating organisation "${SEED_CONFIG.org.org_name}" …`);
    const created = await Organization.create({
      org_id:   randomUUID(),
      org_name: SEED_CONFIG.org.org_name,
      code:     SEED_CONFIG.org.code,
      address:  SEED_CONFIG.org.address,
      phone:    SEED_CONFIG.org.phone,
      email:    SEED_CONFIG.org.email,
      status:   "ACTIVE",
    });
    org = created.get({ plain: true });
  } else {
    console.log(`📌 Organisation found: "${org.org_name}"`);
  }
  const org_id = org.org_id;

  // Ensure org_code is stamped
  await sequelize.query(
    `UPDATE organizations SET org_code = nextval('organizations_org_code_seq') WHERE org_id = :oid AND org_code IS NULL`,
    { replacements: { oid: org_id } }
  );

  // 1b. Department — find by name within org, create if missing
  let dept = await Department.findOne({ where: { department_name: SEED_CONFIG.dept.department_name }, raw: true });
  if (!dept) {
    console.log(`🏬 Creating department "${SEED_CONFIG.dept.department_name}" …`);
    const created = await Department.create({
      department_id:   randomUUID(),
      department_name: SEED_CONFIG.dept.department_name,
    });
    dept = created.get({ plain: true });
  } else {
    console.log(`📌 Department found: "${dept.department_name}"`);
  }
  const department_id = dept.department_id;

  // 1c. Real admin — find by username, create if missing; always reset password
  const hash = await bcrypt.hash("Demo@1234", 10);

  let existingAdmin = await Users.findOne({ where: { username: SEED_CONFIG.realAdmin.username }, raw: true });
  if (!existingAdmin) {
    console.log(`👤 Creating real admin "${SEED_CONFIG.realAdmin.username}" …`);
    existingAdmin = (await Users.create({
      user_id:       randomUUID(),
      role:          "ADMIN",
      name:          SEED_CONFIG.realAdmin.name,
      username:      SEED_CONFIG.realAdmin.username,
      email:         SEED_CONFIG.realAdmin.email,
      phone:         SEED_CONFIG.realAdmin.phone,
      password:      hash,
      org_id,
      department_id,
      status:        "ACTIVE",
    })).get({ plain: true });
  } else {
    await sequelize.query(
      `UPDATE users SET password = :pw, org_id = :oid, department_id = :did WHERE user_id = :uid`,
      { replacements: { pw: hash, oid: org_id, did: department_id, uid: existingAdmin.user_id } }
    );
    console.log(`📌 Real admin found: "${existingAdmin.username}" (password reset)`);
  }
  console.log("");

  // ── 2. Wipe existing org data ─────────────────────────────────────────────
  // Order matters: results → histories → types/patients/devices → tokens → users
  console.log("🗑  Wiping existing org data …");
  await sequelize.query(`DELETE FROM patient_test_results WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_histories      WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_types          WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM patients            WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM devices             WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM tokens              WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM users WHERE org_id = :oid AND role = 'TECHNICIAN'`, { replacements: { oid: org_id } });

  // Purge any stale demo accounts by username (handles cross-org orphans from prior runs)
  const demoUsernames = ["tech.raj", "tech.priya", "tech.meena", "admin.demo"];
  for (const uname of demoUsernames) {
    await sequelize.query(
      `DELETE FROM tokens WHERE user_id IN (SELECT user_id FROM users WHERE username = :u)`,
      { replacements: { u: uname } }
    );
    await sequelize.query(`DELETE FROM users WHERE username = :u`, { replacements: { u: uname } });
  }
  console.log("   Done.\n");

  // ── 3. Reset patient_code sequence → codes will be 00001–00020 ────────────
  // setval(seq, 1, false) → next nextval() returns 1
  await sequelize.query(`SELECT setval('patients_patient_code_seq', 1, false);`);
  console.log("🔢 patient_code sequence reset (first patient = 00001)\n");

  // ── 4. Create accounts ────────────────────────────────────────────────────
  // Sub-admin (ADMIN role) — demo account, always created fresh
  console.log("👤 Creating accounts …");
  const demoAdmin = await Users.create({
    user_id: randomUUID(), role: "ADMIN",
    name: "Demo Admin", username: "admin.demo",
    email: "admin.demo@demo.com", phone: "9900000001",
    password: hash, org_id, department_id, status: "ACTIVE",
  });

  const tech1 = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Raj Kulkarni", username: "tech.raj",
    email: "raj.kulkarni@demo.com", phone: "9900000101",
    password: hash, org_id, department_id, status: "WORKING",
  });
  const tech2 = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Priya Desai", username: "tech.priya",
    email: "priya.desai@demo.com", phone: "9900000102",
    password: hash, org_id, department_id, status: "WORKING",
  });
  const tech3 = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Meena Iyer", username: "tech.meena",
    email: "meena.iyer@demo.com", phone: "9900000103",
    password: hash, org_id, department_id, status: "ACTIVE",
  });

  console.log(`   admin.demo  / Demo@1234  — ${demoAdmin.name} (ADMIN)`);
  if (existingAdmin) console.log(`   ${existingAdmin.username || existingAdmin.email}  / Demo@1234  — (existing admin, password reset)`);
  console.log(`   tech.raj    / Demo@1234  — ${tech1.name}`);
  console.log(`   tech.priya  / Demo@1234  — ${tech2.name}`);
  console.log(`   tech.meena  / Demo@1234  — ${tech3.name}\n`);

  // ── 5. Create devices ─────────────────────────────────────────────────────
  console.log("🖥  Creating 3 devices (DEV-DEMO-001 & 002 assigned, 003 unassigned) …");

  // Use demoAdmin as assigner (existingAdmin may be null when --org flag is used)
  const assignerUserId = existingAdmin?.user_id || demoAdmin.user_id;

  const device1 = await Devices.create({
    device_id: "DEV-DEMO-001", org_id,
    serial_no: "SN-DEMO-001", model: "BIO-CHEQ BQ-A1-01",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: tech1.user_id,
    assigned_by_user_id: assignerUserId,
    assigned_at: new Date(),
  });
  const device2 = await Devices.create({
    device_id: "DEV-DEMO-002", org_id,
    serial_no: "SN-DEMO-002", model: "BIO-CHEQ BQ-A1-01",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: tech2.user_id,
    assigned_by_user_id: assignerUserId,
    assigned_at: new Date(),
  });
  const device3 = await Devices.create({
    device_id: "DEV-DEMO-003", org_id,
    serial_no: "SN-DEMO-003", model: "BIO-CHEQ BQ-A1-01",
    status: "ACTIVE", firmware_version: "v1.9.0", department_id,
    assigned_to_user_id: null,
    assigned_by_user_id: null,
    assigned_at: null,
  });

  console.log(`   ${device1.device_id} → ${tech1.name}`);
  console.log(`   ${device2.device_id} → ${tech2.name}`);
  console.log(`   ${device3.device_id} → (unassigned)\n`);

  const assignedDevices = [device1, device2];

  // ── 6. Create patients ────────────────────────────────────────────────────
  console.log("🧑‍⚕️ Creating 20 patients …");

  const patients = [];
  for (let i = 0; i < PATIENT_POOL.length; i++) {
    const p       = PATIENT_POOL[i];
    const tech    = pick([tech1, tech2, tech3]);
    const regDate = pastDate(Math.floor(rnd(5, 85)));

    const patientCode = await nextval("patients_patient_code_seq");
    const patient = await Patients.create({
      patient_id:   randomUUID(),
      patient_code: patientCode,
      org_id,
      name:         p.name,
      gender:       p.gender,
      dob:          p.dob,
      phone:        p.phone,
      email:        p.email,
      created_by:   tech.user_id,
    });

    await sequelize.query(
      `UPDATE patients SET created_at = :d, updated_at = :d WHERE patient_id = :id`,
      { replacements: { d: regDate, id: patient.patient_id } }
    );

    patients.push({ ...patient.get({ plain: true }), gender: p.gender });
  }
  console.log(`   20 patients created\n`);

  // ── 6. Create BIO-CHEQ test types ─────────────────────────────────────────
  console.log(`🔬 Creating ${TEST_TYPE_DEFS.length} BIO-CHEQ test types …`);

  const createdTypes = await TestTypes.bulkCreate(
    TEST_TYPE_DEFS.map(t => ({
      test_type_id:   randomUUID(),
      org_id,
      name:           t.name,
      unit:           t.unit,
      method:         t.method_options ? t.method_options[0] : null,
      normal_min:     t.normal_min ?? null,
      normal_max:     t.normal_max ?? null,
      male_min:       t.male_min   ?? null,
      male_max:       t.male_max   ?? null,
      female_min:     t.female_min ?? null,
      female_max:     t.female_max ?? null,
      category:       t.category,
      method_options: t.method_options,
      reference_text: t.reference_text,
      critical_low:   t.critical_low   ?? null,
      critical_high:  t.critical_high  ?? null,
      is_qualitative: t.is_qualitative ?? false,
      // Derive specimen_type from category: Calculated → "Calculated", Urine → "Urine", rest → "Blood"
      specimen_type:  t.category === "Calculated" ? "Calculated"
                    : t.category === "Urine test"  ? "Urine"
                    : "Blood",
      is_active:      true,
    })),
    { returning: true }
  );

  const testTypes = createdTypes.map(r => r.get({ plain: true }));

  // Build lookup maps keyed by test name
  const typeByName = testTypes.reduce((m, t) => { m[t.name] = t; return m; }, {});
  const defByName  = TEST_TYPE_DEFS.reduce((m, d) => { m[d.name] = d; return m; }, {});

  console.log(`   ${testTypes.length} test types created\n`);

  // ── 7. Generate sessions + results ────────────────────────────────────────
  console.log("📋 Generating sessions and results …");

  const techPool    = [tech1, tech2, tech3];
  const techWeights = [0.50, 0.35, 0.15];

  let sessionCount = 0;
  let resultCount  = 0;
  let pendingCount = 0;

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const isRecent = daysAgo <= 6;
    const isMid    = daysAgo >= 7 && daysAgo <= 29;
    const sessionsToday = isRecent
      ? Math.floor(rnd(5, 8))
      : isMid
        ? Math.floor(rnd(3, 6))
        : Math.floor(rnd(2, 5));

    for (let s = 0; s < sessionsToday; s++) {
      const patient = pick(patients);

      // ~15% of sessions performed directly by admin (showcases admin test flow)
      const adminPerforms = Math.random() < 0.15;
      const tech     = adminPerforms ? null : weightedPick(techPool, techWeights);
      const performer = adminPerforms ? demoAdmin : tech;
      const device   = adminPerforms
                     ? pick(assignedDevices)
                     : tech.user_id === tech1.user_id ? device1
                     : tech.user_id === tech2.user_id ? device2
                     : pick(assignedDevices);
      const hourSlot = s % 8;
      const testDate = pastDate(daysAgo, hourSlot);

      const isPending = isRecent && !adminPerforms && Math.random() < 0.20;
      const status    = isPending ? "PENDING" : "COMPLETED";
      const notes     = isPending ? null : (Math.random() < 0.55 ? pick(NOTES_POOL) : null);

      const history = await TestHistory.create({
        history_id:         randomUUID(),
        patient_id:         patient.patient_id,
        org_id,
        department_id,
        device_id:          device.device_id,
        entered_by_user_id: performer.user_id,
        test_date:          testDate,
        status,
        notes,
      });

      // Select 1–2 panels, flatten and de-duplicate test names
      const panelCount   = Math.random() < 0.4 ? 2 : 1;
      const shuffled     = [...PANELS].sort(() => Math.random() - 0.5);
      const selectedPanels = shuffled.slice(0, panelCount);
      const testNames    = [...new Set(selectedPanels.flat())];

      // Build result rows
      const rows = testNames
        .filter(name => typeByName[name]) // guard: skip if test type not in DB
        .map(name => {
          const tt  = typeByName[name];
          const def = defByName[name];
          const isQual = def.is_qualitative ?? false;
          return {
            result_id:    randomUUID(),
            history_id:   history.history_id,
            patient_id:   patient.patient_id,
            org_id,
            test_type_id: tt.test_type_id,
            value_num:    (!isPending && !isQual)
              ? def.genValue(patient.gender)
              : null,
            value_text:   (!isPending && isQual)
              ? def.genValue()
              : null,
            method_used:  (!isPending && tt.method_options && tt.method_options.length > 0)
              ? tt.method_options[0]
              : null,
          };
        });

      await PatientTestResults.bulkCreate(rows);
      sessionCount++;
      resultCount  += rows.length;
      if (isPending) pendingCount++;
    }
  }

  console.log(`   ${sessionCount} sessions  (${pendingCount} PENDING · ${sessionCount - pendingCount} COMPLETED)`);
  console.log(`   ${resultCount} results\n`);

  // ── Done ──────────────────────────────────────────────────────────────────
  const [orgRow] = await sequelize.query(
    `SELECT org_name, org_code FROM organizations WHERE org_id = :oid`,
    { replacements: { oid: org_id }, type: sequelize.QueryTypes.SELECT }
  );
  const orgDisplay = orgRow
    ? `${orgRow.org_name}  #${String(orgRow.org_code).padStart(5, "0")}`
    : org_id;

  console.log(`\n🎉 Seed complete!\n`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Organisation : ${orgDisplay}`);
  console.log("");
  console.log("  ADMIN accounts  (password: Demo@1234)");
  console.log(`    ${SEED_CONFIG.realAdmin.username.padEnd(15)}— ${SEED_CONFIG.realAdmin.name} (real admin)`);
  console.log(`    admin.demo     — Demo Admin (seed account)`);
  console.log("");
  console.log("  TECHNICIAN accounts  (password: Demo@1234)");
  console.log("    tech.raj       — Raj Kulkarni   (WORKING · DEV-DEMO-001)");
  console.log("    tech.priya     — Priya Desai    (WORKING · DEV-DEMO-002)");
  console.log("    tech.meena     — Meena Iyer     (ACTIVE  · no device)");
  console.log("");
  console.log("  Devices  (BIO-CHEQ BQ-A1-01)");
  console.log("    DEV-DEMO-001   → tech.raj");
  console.log("    DEV-DEMO-002   → tech.priya");
  console.log("    DEV-DEMO-003   → unassigned");
  console.log("");
  console.log("  Patients : 20  (codes 00001 – 00020)");
  console.log(`  Sessions : ${sessionCount}  (${pendingCount} PENDING · ${sessionCount - pendingCount} COMPLETED)`);
  console.log(`  Results  : ${resultCount}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message || err);
  process.exit(1);
});
