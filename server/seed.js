/**
 * EDHHA Demo Seed
 *
 * Works on a fresh machine (blank DB) or an existing one.
 * Edit SEED_CONFIG to match your environment — everything else is automatic.
 *
 * Creates / upserts (safe to run multiple times):
 *   - 3 plans         : basic, premium, edhha_custom
 *   - Organisation, Department, real Admin  (from SEED_CONFIG)  → premium plan
 *   - EIPL demo data  : 4 accounts, 2 devices, 5 patients, 37 test types, 5 sessions
 *
 * Wipes and recreates every run:
 *   EIPL demo  : admin.demo / tech.raj / tech.meena / tech.suresh
 *   EDHHA org  : full org + edhha.admin / edhha.tech + 2 devices + 31 test types + 2 patients + 3 sessions
 *
 * Run:  node server/seed.js
 *
 * Passwords:
 *   EIPL accounts : Demo@1234
 *   EDHHA accounts: Edhha@1234
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
import Plans              from "./database/plans.js";

// ─────────────────────────────────────────────────────────────────────────────
// SEED_CONFIG — edit this block when setting up on a new machine
// ─────────────────────────────────────────────────────────────────────────────

const SEED_CONFIG = {
  org: {
    org_name: "EIPL Diagnostics",
    code:     "EIPL01",
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
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PLANS — feature tiers
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_DEFS = [
  {
    name:         "basic",
    tier:         "basic",
    display_name: "Basic",
    description:  "Urine analysis only — entry-level clinic package.",
    config: {
      allowed_specimen_types: ["Urine"],
      all_tests:              false,
    },
  },
  {
    name:         "premium",
    tier:         "premium",
    display_name: "Premium",
    description:  "Full catalogue — all blood and urine test types, all device models.",
    config: {
      allowed_specimen_types: ["Blood", "Urine"],
      all_tests:              true,
    },
  },
  {
    name:         "edhha_custom",
    tier:         "custom",
    display_name: "Edhha Custom",
    description:  "Custom plan for Edhha Diagnostics: selected serum biochemistry blood panel + full urine analysis.",
    config: {
      allowed_specimen_types: ["Blood", "Urine"],
      allowed_blood_tests: [
        "Hb", "RBS", "S. Creatinine", "S. Urea", "S. Uric Acid",
        "S. Total Bilirubin", "S. Direct Bilirubin", "S. Albumin", "S. TP",
        "S. Calcium", "S. TC", "S. Triglycerides", "S. HDL-C", "HbA1C",
      ],
      allowed_device_models: [
        "BIO-CHEQ (BQ-A1-01 Series)",
        "Urine Analyzer (BK150)",
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATA — EIPL
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_USERNAMES = ["admin.demo", "tech.raj", "tech.meena", "tech.suresh"];

const EIPL_PATIENTS = [
  { id: "00001", name: "Arjun Sharma",  gender: "MALE",   dob: "1980-04-12", phone: "9810011001", email: "arjun.sharma@mail.com"  },
  { id: "00002", name: "Preethi Nair",  gender: "FEMALE", dob: "1993-07-25", phone: "9810011002", email: "preethi.nair@mail.com"  },
  { id: "00003", name: "Mohammed Rafi", gender: "MALE",   dob: "1975-11-03", phone: "9810011003", email: "mohammed.rafi@mail.com" },
  { id: "00004", name: "Sunita Devi",   gender: "FEMALE", dob: "1988-02-18", phone: "9810011004", email: "sunita.devi@mail.com"   },
  { id: "00005", name: "Vikram Patel",  gender: "MALE",   dob: "1965-09-30", phone: "9810011005", email: "vikram.patel@mail.com"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATA — EDHHA
// ─────────────────────────────────────────────────────────────────────────────

const EDHHA_USERNAMES = ["edhha.admin", "edhha.tech"];

const EDHHA_PATIENTS = [
  { id: "00006", name: "Ravi Kumar",    gender: "MALE",   dob: "1978-03-15", phone: "9820022001", email: "ravi.kumar@mail.com"    },
  { id: "00007", name: "Lakshmi Reddy", gender: "FEMALE", dob: "1990-08-22", phone: "9820022002", email: "lakshmi.reddy@mail.com" },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEST TYPE CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────

// ── Blood tests — Sheet1, non-calculated only (20 tests) ─────────────────────

const BLOOD_TESTS = [
  {
    name: "Hb", full_name: "Haemoglobin", unit: "g/dL", category: "Haemogram biochemistry",
    method_options: ["Alkaline Hematin D Method"],
    reference_text: "Male: 14–18 g/dL\nFemale: 12–16 g/dL",
    normal_min: 12, normal_max: 18, male_min: 14, male_max: 18, female_min: 12, female_max: 16,
    critical_low: 7, critical_high: 20, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "RBS", full_name: "Random Blood Glucose", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["GOD-POD Method"],
    reference_text: "Normal: <200 mg/dL\nDiabetes mellitus: >200 mg/dL",
    normal_min: null, normal_max: 200, male_min: null, male_max: 200, female_min: null, female_max: 200,
    critical_low: 60, critical_high: 300, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Creatinine", full_name: "Serum Creatinine", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Modified Jaffe Method"],
    reference_text: "Male: 0.66–1.25 mg/dL\nFemale: 0.52–1.04 mg/dL",
    normal_min: 0.52, normal_max: 1.25, male_min: 0.66, male_max: 1.25, female_min: 0.52, female_max: 1.04,
    critical_low: null, critical_high: 5, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Urea", full_name: "Serum Urea", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Berthlot Endpoint Method"],
    reference_text: "Male: 19–43 mg/dL\nFemale: 20–36 mg/dL",
    normal_min: 19, normal_max: 43, male_min: 19, male_max: 43, female_min: 20, female_max: 36,
    critical_low: null, critical_high: 100, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Uric Acid", full_name: "Serum Uric Acid", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Uricase-POD Method"],
    reference_text: "Male: 3.5–8.5 mg/dL\nFemale: 2.5–6.2 mg/dL",
    normal_min: 2.5, normal_max: 8.5, male_min: 3.5, male_max: 8.5, female_min: 2.5, female_max: 6.2,
    critical_low: null, critical_high: 13, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Total Bilirubin", full_name: "Total Bilirubin", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Diazo Method"],
    reference_text: "0–1.2 mg/dL",
    normal_min: 0, normal_max: 1.2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 15, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Direct Bilirubin", full_name: "Direct Bilirubin", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Diazo Method"],
    reference_text: "0–0.3 mg/dL",
    normal_min: 0, normal_max: 0.3, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 5, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Albumin", full_name: "Serum Albumin", unit: "g/dL", category: "Serum Biochemistry",
    method_options: ["Bromocresol Green Method"],
    reference_text: "3.5–5.2 g/dL",
    normal_min: 3.5, normal_max: 5.2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 2, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. TP", full_name: "Serum Total Protein", unit: "g/dL", category: "Serum Biochemistry",
    method_options: ["Biuret Method"],
    reference_text: "6.0–8.3 g/dL",
    normal_min: 6.0, normal_max: 8.3, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 4, critical_high: 10, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Calcium", full_name: "Serum Calcium", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Arsenazo III Method"],
    reference_text: "8.4–10.2 mg/dL",
    normal_min: 8.4, normal_max: 10.2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 6.5, critical_high: 13, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. TC", full_name: "Serum Total Cholesterol", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["CHOD-POD Method"],
    reference_text: "Desirable: <200 mg/dL\nBorderline High: 200–239 mg/dL\nHigh: ≥240 mg/dL",
    normal_min: null, normal_max: 200, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 300, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Triglycerides", full_name: "Serum Triglycerides", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["GPO-POD Method"],
    reference_text: "Normal: <150 mg/dL\nBorderline High: 150–199 mg/dL\nHigh: 200–499 mg/dL\nVery High: ≥500 mg/dL",
    normal_min: null, normal_max: 150, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 500, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. HDL-C", full_name: "Serum HDL Cholesterol", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Polymer-Detergent Method"],
    reference_text: ">40 mg/dL",
    normal_min: 40, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 20, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "HbA1C", full_name: "Glycated Haemoglobin", unit: "%", category: "Serum Biochemistry",
    method_options: ["Immunoturbidimetric Method"],
    reference_text: "Non-diabetic: ≤5.6%\nPre-diabetic: 5.7–6.4%\nDiabetic: ≥6.5%",
    normal_min: null, normal_max: 5.6, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Sodium", full_name: "Serum Sodium", unit: "mmol/L", category: "Serum Biochemistry",
    method_options: ["Colorimetric Method"],
    reference_text: "136–145 mmol/L",
    normal_min: 136, normal_max: 145, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 120, critical_high: 160, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Potassium", full_name: "Serum Potassium", unit: "mmol/L", category: "Serum Biochemistry",
    method_options: ["Colorimetric Method"],
    reference_text: "3.5–5.1 mmol/L",
    normal_min: 3.5, normal_max: 5.1, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 2.5, critical_high: 6.5, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Chloride", full_name: "Serum Chloride", unit: "mmol/L", category: "Serum Biochemistry",
    method_options: ["Thiocyanate Method"],
    reference_text: "98–109 mmol/L",
    normal_min: 98, normal_max: 109, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 80, critical_high: 115, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Magnesium", full_name: "Serum Magnesium", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Xylidyl Blue Method"],
    reference_text: "1.6–3.0 mg/dL",
    normal_min: 1.6, normal_max: 3.0, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 1.0, critical_high: 4.0, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Phosphorus", full_name: "Serum Phosphorus", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Ammonium Molybdate Method"],
    reference_text: "2.5–4.5 mg/dL",
    normal_min: 2.5, normal_max: 4.5, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 1.0, critical_high: 7.0, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Zinc", full_name: "Serum Zinc", unit: "µg/dL", category: "Serum Biochemistry",
    method_options: ["Bromo PAPS Method"],
    reference_text: "60–120 µg/dL",
    normal_min: 60, normal_max: 120, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
];

// ── Urine tests — Sheet2, all 17 tests ───────────────────────────────────────

const URINE_TESTS = [
  {
    name: "Colour", full_name: null, unit: "", category: "Urine test",
    method_options: ["Visual Method"],
    reference_text: "Pale Yellow",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "Transparency", full_name: null, unit: "", category: "Urine test",
    method_options: ["Visual Method"],
    reference_text: "Clear",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "pH", full_name: "pH (Acidity/Alkalinity)", unit: "", category: "Urine test",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "5.0–8.0",
    normal_min: 5.0, normal_max: 8.0, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "SG", full_name: "Specific Gravity", unit: "", category: "Urine test",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "1.003–1.030",
    normal_min: 1.003, normal_max: 1.030, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "LEU", full_name: "Leukocyte Esterase (WBC)", unit: "cell/μL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative to Trace",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "URO", full_name: "Urobilinogen", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "0.2–1.0 mg/dL",
    normal_min: 0.2, normal_max: 1.0, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "ALB", full_name: "Microalbumin", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "<2 mg/dL",
    normal_min: null, normal_max: 2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "PRO", full_name: "Protein", unit: "g/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 1, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "BIL", full_name: "Bilirubin", unit: "µmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "GLU", full_name: "Glucose (Sugar)", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "ASC", full_name: "Ascorbic Acid", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative to Low",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "KET", full_name: "Ketones", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "NIT", full_name: "Nitrites", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "CRE", full_name: "Creatinine", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "1.13–10.18 mg/dL",
    normal_min: 1.13, normal_max: 10.18, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "BLO", full_name: "Blood", unit: "cell/μL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "CA", full_name: "Calcium", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "10–30 mg/dL",
    normal_min: 10, normal_max: 30, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "ACR", full_name: "Albumin Creatinine Ratio", unit: "mg/g", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "<30 mg/g",
    normal_min: null, normal_max: 30, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 300, is_qualitative: false, specimen_type: "Urine",
  },
];

// Full EIPL catalogue (all 37)
const EIPL_TEST_TYPES = [...BLOOD_TESTS, ...URINE_TESTS];

// Edhha custom plan — 14 blood tests (from image) + all 17 urine tests = 31 total
const EDHHA_BLOOD_TEST_NAMES = new Set([
  "Hb", "RBS", "S. Creatinine", "S. Urea", "S. Uric Acid",
  "S. Total Bilirubin", "S. Direct Bilirubin", "S. Albumin", "S. TP",
  "S. Calcium", "S. TC", "S. Triglycerides", "S. HDL-C", "HbA1C",
]);
const EDHHA_TEST_TYPES = [
  ...BLOOD_TESTS.filter(t => EDHHA_BLOOD_TEST_NAMES.has(t.name)),
  ...URINE_TESTS,
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function buildTestTypeRows(types, org_id) {
  return types.map(t => ({
    test_type_id:   randomUUID(),
    org_id,
    name:           t.name,
    full_name:      t.full_name ?? null,
    unit:           t.unit,
    method:         t.method_options?.[0] ?? null,
    normal_min:     t.normal_min,
    normal_max:     t.normal_max,
    male_min:       t.male_min,
    male_max:       t.male_max,
    female_min:     t.female_min,
    female_max:     t.female_max,
    category:       t.category,
    method_options: t.method_options,
    reference_text: t.reference_text,
    critical_low:   t.critical_low,
    critical_high:  t.critical_high,
    is_qualitative: t.is_qualitative,
    specimen_type:  t.specimen_type,
    is_active:      true,
  }));
}


// ─────────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {

  // ── Connect ──────────────────────────────────────────────────────────────────
  await sequelize.authenticate();
  console.log("✅ DB connected\n");

  // ── Sync (creates missing tables) ────────────────────────────────────────────
  await sequelize.sync();
  console.log("✅ Tables synced\n");

  // ── Schema patches (idempotent) ───────────────────────────────────────────────

  // Migrate patient_id from UUID → TEXT on all three tables (once only)
  await sequelize.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'patient_id' AND data_type = 'uuid'
      ) THEN
        ALTER TABLE patient_test_results DROP CONSTRAINT IF EXISTS patient_test_results_patient_id_fkey;
        ALTER TABLE test_histories       DROP CONSTRAINT IF EXISTS test_histories_patient_id_fkey;
        ALTER TABLE patients ALTER COLUMN patient_id TYPE TEXT USING patient_id::text;
        ALTER TABLE test_histories ALTER COLUMN patient_id TYPE TEXT USING patient_id::text;
        ALTER TABLE patient_test_results ALTER COLUMN patient_id TYPE TEXT USING patient_id::text;
      END IF;
    END $$;
  `);

  // Drop legacy patient_code columns (no longer needed — patient_id IS the display code)
  await sequelize.query(`ALTER TABLE patients             DROP COLUMN IF EXISTS patient_code;`);
  await sequelize.query(`ALTER TABLE test_histories       DROP COLUMN IF EXISTS patient_code;`);
  await sequelize.query(`ALTER TABLE patient_test_results DROP COLUMN IF EXISTS patient_code;`);

  // Sequence for generating 5-digit patient IDs
  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS patients_id_seq START 1;`);

  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS organizations_org_code_seq START 1;`);
  await sequelize.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code INTEGER;`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN org_code SET DEFAULT nextval('organizations_org_code_seq');`);

  // plan_id FK on organizations (nullable so existing rows are unaffected until updated)
  await sequelize.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id UUID;`);

  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS org_id UUID;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS category TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS method_options JSONB;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS reference_text TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_low FLOAT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_high FLOAT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS is_qualitative BOOLEAN NOT NULL DEFAULT false;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS specimen_type TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS full_name TEXT;`);

  await sequelize.query(`ALTER TABLE patient_test_results ADD COLUMN IF NOT EXISTS method_used TEXT;`);

  await sequelize.query(`DO $$ BEGIN CREATE TYPE enum_test_history_status AS ENUM ('PENDING','COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await sequelize.query(`ALTER TABLE test_histories ADD COLUMN IF NOT EXISTS status enum_test_history_status NOT NULL DEFAULT 'PENDING';`);

  await sequelize.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);

  // Drop legacy single-column unique constraint on test_types.name — test types
  // are now org-scoped, so the same name may exist in multiple organizations.
  await sequelize.query(`ALTER TABLE test_types DROP CONSTRAINT IF EXISTS test_types_name_key;`);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS test_types_name_org_id_key
    ON test_types (name, org_id);
  `);

  // Drop legacy unique constraint on organizations.org_code — it conflicts with
  // sequence-based assignment on re-runs.
  await sequelize.query(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_org_code_key;`);

  // Clean up orphan records that have no org_id (created before org scoping).
  // Must delete in FK-dependency order.
  await sequelize.query(`
    DELETE FROM patient_test_results
    WHERE test_type_id IN (SELECT test_type_id FROM test_types WHERE org_id IS NULL);
  `);
  await sequelize.query(`DELETE FROM patient_test_results WHERE org_id IS NULL;`);
  await sequelize.query(`DELETE FROM test_histories WHERE org_id IS NULL;`);
  await sequelize.query(`DELETE FROM test_types WHERE org_id IS NULL;`);
  await sequelize.query(`DELETE FROM patients WHERE org_id IS NULL;`);

  console.log("✅ Schema patches applied\n");

  // ── 1. Upsert plans ───────────────────────────────────────────────────────────
  console.log("📋 Upserting plans …");
  const planMap = {};
  for (const pd of PLAN_DEFS) {
    const [plan] = await Plans.findOrCreate({
      where: { name: pd.name },
      defaults: {
        plan_id:      randomUUID(),
        tier:         pd.tier,
        display_name: pd.display_name,
        description:  pd.description,
        config:       pd.config,
      },
    });
    // Keep config in sync on re-runs
    await plan.update({ tier: pd.tier, display_name: pd.display_name, description: pd.description, config: pd.config });
    planMap[pd.name] = plan.get({ plain: true });
    console.log(`   ${pd.tier.padEnd(8)} → ${pd.name}  (${plan.plan_id})`);
  }
  const premiumPlan   = planMap["premium"];
  const edhhaCustomPlan = planMap["edhha_custom"];
  console.log("");

  // ── 2. Upsert EIPL org → assign premium plan ──────────────────────────────────
  let org = await Organization.findOne({ where: { code: SEED_CONFIG.org.code }, raw: true });
  if (!org) {
    console.log(`🏢 Creating org "${SEED_CONFIG.org.org_name}" …`);
    org = (await Organization.create({
      org_id:   randomUUID(),
      org_name: SEED_CONFIG.org.org_name,
      code:     SEED_CONFIG.org.code,
      address:  SEED_CONFIG.org.address,
      phone:    SEED_CONFIG.org.phone,
      email:    SEED_CONFIG.org.email,
      status:   "ACTIVE",
      plan_id:  premiumPlan.plan_id,
    })).get({ plain: true });
  } else {
    await sequelize.query(
      `UPDATE organizations SET plan_id = :pid WHERE org_id = :oid`,
      { replacements: { pid: premiumPlan.plan_id, oid: org.org_id } }
    );
    console.log(`📌 Org found: "${org.org_name}" → plan set to premium`);
  }
  const org_id = org.org_id;
  await sequelize.query(
    `UPDATE organizations SET org_code = nextval('organizations_org_code_seq') WHERE org_id = :oid AND org_code IS NULL`,
    { replacements: { oid: org_id } }
  );

  // Assign premium to any other pre-existing orgs with no plan
  await sequelize.query(
    `UPDATE organizations SET plan_id = :pid WHERE plan_id IS NULL`,
    { replacements: { pid: premiumPlan.plan_id } }
  );

  // ── 3. Upsert Department ──────────────────────────────────────────────────────
  let dept = await Department.findOne({ where: { department_name: SEED_CONFIG.dept.department_name }, raw: true });
  if (!dept) {
    console.log(`🏬 Creating dept "${SEED_CONFIG.dept.department_name}" …`);
    dept = (await Department.create({
      department_id:   randomUUID(),
      department_name: SEED_CONFIG.dept.department_name,
    })).get({ plain: true });
  } else {
    console.log(`📌 Dept found: "${dept.department_name}"`);
  }
  const department_id = dept.department_id;

  // ── 4. Upsert real admin ──────────────────────────────────────────────────────
  const hashDemo  = await bcrypt.hash("Demo@1234",  10);
  const hashEdhha = await bcrypt.hash("Edhha@1234", 10);

  let realAdmin = await Users.findOne({ where: { username: SEED_CONFIG.realAdmin.username }, raw: true });
  if (!realAdmin) {
    console.log(`👤 Creating real admin "${SEED_CONFIG.realAdmin.username}" …`);
    realAdmin = (await Users.create({
      user_id: randomUUID(), role: "ADMIN",
      name:     SEED_CONFIG.realAdmin.name,
      username: SEED_CONFIG.realAdmin.username,
      email:    SEED_CONFIG.realAdmin.email,
      phone:    SEED_CONFIG.realAdmin.phone,
      password: hashDemo, org_id, department_id, status: "ACTIVE",
    })).get({ plain: true });
  } else {
    await sequelize.query(
      `UPDATE users SET password = :pw, org_id = :oid, department_id = :did WHERE user_id = :uid`,
      { replacements: { pw: hashDemo, oid: org_id, did: department_id, uid: realAdmin.user_id } }
    );
    console.log(`📌 Real admin found: "${realAdmin.username}" (password reset)`);
  }
  console.log("");

  // ── 5. Wipe EIPL demo data ────────────────────────────────────────────────────
  console.log("🗑  Wiping EIPL demo data …");
  await sequelize.query(`DELETE FROM patient_test_results WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_histories      WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_types          WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM patients            WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM devices             WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM tokens              WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM users WHERE org_id = :oid AND role = 'TECHNICIAN'`, { replacements: { oid: org_id } });

  // Cross-org device cleanup (serial_no has global unique constraint)
  await sequelize.query(
    `DELETE FROM devices WHERE device_id IN ('DEV-DEMO-001','DEV-DEMO-002') OR serial_no IN ('SN-DEMO-001','SN-DEMO-002')`
  );

  // Cross-org user cleanup
  for (const uname of DEMO_USERNAMES) {
    const found = await sequelize.query(
      `SELECT user_id FROM users WHERE username = :u LIMIT 1`,
      { replacements: { u: uname }, type: sequelize.QueryTypes.SELECT }
    );
    if (found.length > 0) {
      const uid = found[0].user_id;
      await sequelize.query(
        `DELETE FROM patient_test_results WHERE history_id IN (SELECT history_id FROM test_histories WHERE entered_by_user_id = :uid)`,
        { replacements: { uid } }
      );
      await sequelize.query(`DELETE FROM test_histories WHERE entered_by_user_id = :uid`, { replacements: { uid } });
      await sequelize.query(`DELETE FROM patients WHERE created_by = :uid`, { replacements: { uid } });
      await sequelize.query(
        `UPDATE devices SET assigned_to_user_id = NULL, assigned_by_user_id = NULL WHERE assigned_to_user_id = :uid OR assigned_by_user_id = :uid`,
        { replacements: { uid } }
      );
    }
    await sequelize.query(`DELETE FROM tokens WHERE user_id IN (SELECT user_id FROM users WHERE username = :u)`, { replacements: { u: uname } });
    await sequelize.query(`DELETE FROM users WHERE username = :u`, { replacements: { u: uname } });
  }
  console.log("   Done.\n");

  // ── 6. Reset patient ID sequence ─────────────────────────────────────────────
  await sequelize.query(`SELECT setval('patients_id_seq', 1, false);`);

  // ── 7. Create EIPL demo accounts ──────────────────────────────────────────────
  console.log("👤 Creating EIPL accounts …");

  const demoAdmin = await Users.create({
    user_id: randomUUID(), role: "ADMIN",
    name: "Demo Admin", username: "admin.demo",
    email: "admin.demo@demo.com", phone: "9900000001",
    password: hashDemo, org_id, department_id, status: "ACTIVE",
  });

  const techRaj = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Raj Kulkarni", username: "tech.raj",
    email: "raj.kulkarni@demo.com", phone: "9900000101",
    password: hashDemo, org_id, department_id, status: "WORKING",
  });

  await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Meena Iyer", username: "tech.meena",
    email: "meena.iyer@demo.com", phone: "9900000102",
    password: hashDemo, org_id, department_id, status: "INACTIVE",
  });

  await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Suresh Nair", username: "tech.suresh",
    email: "suresh.nair@demo.com", phone: "9900000103",
    password: hashDemo, org_id, department_id, status: "INACTIVE",
  });

  console.log(`   admin.demo  / Demo@1234 — Demo Admin     (ADMIN)`);
  console.log(`   tech.raj    / Demo@1234 — Raj Kulkarni   (TECHNICIAN · WORKING)`);
  console.log(`   tech.meena  / Demo@1234 — Meena Iyer     (TECHNICIAN · INACTIVE)`);
  console.log(`   tech.suresh / Demo@1234 — Suresh Nair    (TECHNICIAN · INACTIVE)\n`);

  // ── 8. Create EIPL devices ────────────────────────────────────────────────────
  console.log("🖥  Creating EIPL devices …");

  await Devices.create({
    device_id: "DEV-DEMO-001", org_id,
    serial_no: "SN-DEMO-001", model: "BIO-CHEQ (BQ-A1-01 Series)",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: techRaj.user_id,
    assigned_by_user_id: realAdmin.user_id,
    assigned_at: new Date(),
  });

  await Devices.create({
    device_id: "DEV-DEMO-002", org_id,
    serial_no: "SN-DEMO-002", model: "Urine Analyzer (BK150)",
    status: "ACTIVE", firmware_version: "v1.2.0", department_id,
    assigned_to_user_id: techRaj.user_id,
    assigned_by_user_id: realAdmin.user_id,
    assigned_at: new Date(),
  });

  console.log(`   DEV-DEMO-001 → tech.raj  (BIO-CHEQ BQ-A1-01 — Blood)`);
  console.log(`   DEV-DEMO-002 → tech.raj  (Urine Analyzer BK150 — Urine)\n`);

  // ── 9. Create EIPL test types (37 total) ──────────────────────────────────────
  console.log("🔬 Creating EIPL test types …");

  const ciplCreated = await TestTypes.bulkCreate(buildTestTypeRows(EIPL_TEST_TYPES, org_id), { returning: true });
  const ciplByName = {};
  ciplCreated.forEach(r => { ciplByName[r.name] = r; });

  console.log(`   ${BLOOD_TESTS.length} blood + ${URINE_TESTS.length} urine = ${EIPL_TEST_TYPES.length} total\n`);

  // ── 10. Create EIPL patients ──────────────────────────────────────────────────
  console.log("🧑‍⚕️ Creating EIPL patients …");

  const ciplPatients = [];
  for (const p of EIPL_PATIENTS) {
    const patient = await Patients.create({
      patient_id: p.id, org_id,
      name: p.name, gender: p.gender, dob: p.dob, phone: p.phone, email: p.email,
      created_by: techRaj.user_id,
    });
    ciplPatients.push({ ...patient.get({ plain: true }), gender: p.gender });
  }
  console.log(`   5 patients created (IDs 00001–00005)\n`);

  // ── 11. Create EIPL sessions ──────────────────────────────────────────────────
  console.log("📋 Creating EIPL sessions …");

  async function makeSession({ org_id, dept_id, typeByName, patient, performer, device_id, daysBack, status, notes, tests }) {
    const history = await TestHistory.create({
      history_id:         randomUUID(),
      patient_id:         patient.patient_id,
      org_id,
      department_id:      dept_id,
      device_id,
      entered_by_user_id: performer.user_id,
      test_date:          daysAgo(daysBack),
      status,
      notes: status === "PENDING" ? null : notes,
    });

    const rows = tests.map(({ typeName, value_num, value_text }) => {
      const tt = typeByName[typeName];
      if (!tt) throw new Error(`Unknown test type name: "${typeName}"`);
      return {
        result_id:   randomUUID(),
        history_id:  history.history_id,
        patient_id:  patient.patient_id,
        org_id,
        test_type_id: tt.test_type_id,
        value_num:   status === "PENDING" ? null : (value_num ?? null),
        value_text:  status === "PENDING" ? null : (value_text ?? null),
        method_used: tt.method_options?.[0] ?? null,
      };
    });

    await PatientTestResults.bulkCreate(rows);
    return history;
  }

  const [p1, p2, p3, p4] = ciplPatients;

  await makeSession({
    org_id, dept_id: department_id, typeByName: ciplByName,
    patient: p1, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 5, status: "COMPLETED", notes: "Routine follow-up",
    tests: [
      { typeName: "Hb",  value_num: 15.2 },
      { typeName: "RBS", value_num: 225  },
    ],
  });

  await makeSession({
    org_id, dept_id: department_id, typeByName: ciplByName,
    patient: p2, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 10, status: "COMPLETED", notes: "Diabetes management check",
    tests: [
      { typeName: "RBS",   value_num: 180 },
      { typeName: "HbA1C", value_num: 7.8 },
    ],
  });

  await makeSession({
    org_id, dept_id: department_id, typeByName: ciplByName,
    patient: p2, performer: demoAdmin, device_id: "DEV-DEMO-002",
    daysBack: 3, status: "COMPLETED", notes: "Urine routine",
    tests: [
      { typeName: "pH",  value_num: 6.5        },
      { typeName: "PRO", value_text: "Negative" },
      { typeName: "BLO", value_text: "Positive" },
      { typeName: "GLU", value_text: "Negative" },
    ],
  });

  await makeSession({
    org_id, dept_id: department_id, typeByName: ciplByName,
    patient: p3, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 2, status: "COMPLETED", notes: "Annual health check",
    tests: [
      { typeName: "Hb",            value_num: 13.8 },
      { typeName: "S. Creatinine", value_num: 1.9  },
      { typeName: "S. TC",         value_num: 255  },
    ],
  });

  await makeSession({
    org_id, dept_id: department_id, typeByName: ciplByName,
    patient: p4, performer: techRaj, device_id: null,
    daysBack: 1, status: "PENDING", notes: null,
    tests: [
      { typeName: "Hb"    },
      { typeName: "RBS"   },
      { typeName: "HbA1C" },
    ],
  });

  console.log("   5 sessions (Blood: 1,2,4 · Urine: 3 · Pending: 5)\n");

  // ═══════════════════════════════════════════════════════════════
  //  EDHHA ORG — custom plan
  // ═══════════════════════════════════════════════════════════════

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" Setting up EDHHA org (custom plan)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 12. Wipe edhha org ────────────────────────────────────────────────────────
  console.log("🗑  Wiping edhha org …");

  const existingEdhha = await sequelize.query(
    `SELECT org_id FROM organizations WHERE code = 'EDHHA01' LIMIT 1`,
    { type: sequelize.QueryTypes.SELECT }
  );

  if (existingEdhha.length > 0) {
    const eid = existingEdhha[0].org_id;
    await sequelize.query(`DELETE FROM patient_test_results WHERE org_id = :eid`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM test_histories      WHERE org_id = :eid`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM test_types          WHERE org_id = :eid`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM patients            WHERE org_id = :eid`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM devices             WHERE org_id = :eid`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM tokens              WHERE org_id = :eid`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM users WHERE org_id = :eid AND role != 'SUPER_ADMIN'`, { replacements: { eid } });
    await sequelize.query(`DELETE FROM organizations WHERE org_id = :eid`, { replacements: { eid } });
  }

  // Cross-org cleanup for edhha serial numbers and usernames
  await sequelize.query(
    `DELETE FROM devices WHERE device_id IN ('DEV-EDHHA-001','DEV-EDHHA-002') OR serial_no IN ('SN-EDHHA-001','SN-EDHHA-002')`
  );

  for (const uname of EDHHA_USERNAMES) {
    const found = await sequelize.query(
      `SELECT user_id FROM users WHERE username = :u LIMIT 1`,
      { replacements: { u: uname }, type: sequelize.QueryTypes.SELECT }
    );
    if (found.length > 0) {
      const uid = found[0].user_id;
      await sequelize.query(
        `DELETE FROM patient_test_results WHERE history_id IN (SELECT history_id FROM test_histories WHERE entered_by_user_id = :uid)`,
        { replacements: { uid } }
      );
      await sequelize.query(`DELETE FROM test_histories WHERE entered_by_user_id = :uid`, { replacements: { uid } });
      await sequelize.query(`DELETE FROM patients WHERE created_by = :uid`, { replacements: { uid } });
      await sequelize.query(
        `UPDATE devices SET assigned_to_user_id = NULL, assigned_by_user_id = NULL WHERE assigned_to_user_id = :uid OR assigned_by_user_id = :uid`,
        { replacements: { uid } }
      );
    }
    await sequelize.query(`DELETE FROM tokens WHERE user_id IN (SELECT user_id FROM users WHERE username = :u)`, { replacements: { u: uname } });
    await sequelize.query(`DELETE FROM users WHERE username = :u`, { replacements: { u: uname } });
  }

  console.log("   Done.\n");

  // ── 13. Create edhha org ──────────────────────────────────────────────────────
  const edhhaOrg = (await Organization.create({
    org_id:   randomUUID(),
    org_name: "Edhha Diagnostics",
    code:     "EDHHA01",
    address:  "Hyderabad, Telangana",
    phone:    "9700000000",
    email:    "info@edhha.com",
    status:   "ACTIVE",
    plan_id:  edhhaCustomPlan.plan_id,
  })).get({ plain: true });

  const edhha_org_id = edhhaOrg.org_id;

  await sequelize.query(
    `UPDATE organizations SET org_code = nextval('organizations_org_code_seq') WHERE org_id = :oid AND org_code IS NULL`,
    { replacements: { oid: edhha_org_id } }
  );

  console.log(`🏢 Created org "Edhha Diagnostics" (plan: edhha_custom)\n`);

  // ── 14. Create edhha department ───────────────────────────────────────────────
  let edhhaDept = await Department.findOne({ where: { department_name: "Edhha Diagnostics Lab" }, raw: true });
  if (!edhhaDept) {
    edhhaDept = (await Department.create({
      department_id:   randomUUID(),
      department_name: "Edhha Diagnostics Lab",
    })).get({ plain: true });
  }
  const edhha_dept_id = edhhaDept.department_id;

  // ── 15. Create edhha accounts ─────────────────────────────────────────────────
  console.log("👤 Creating edhha accounts …");

  const edhhaAdmin = await Users.create({
    user_id: randomUUID(), role: "ADMIN",
    name: "Edhha Admin", username: "edhha.admin",
    email: "admin@edhha.com", phone: "9700000001",
    password: hashEdhha, org_id: edhha_org_id, department_id: edhha_dept_id, status: "ACTIVE",
  });

  const edhhaTech = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Edhha Tech", username: "edhha.tech",
    email: "tech@edhha.com", phone: "9700000002",
    password: hashEdhha, org_id: edhha_org_id, department_id: edhha_dept_id, status: "INACTIVE",
  });

  console.log(`   edhha.admin / Edhha@1234 — Edhha Admin  (ADMIN)`);
  console.log(`   edhha.tech  / Edhha@1234 — Edhha Tech   (TECHNICIAN · INACTIVE)\n`);

  // ── 16. Create edhha devices ──────────────────────────────────────────────────
  console.log("🖥  Creating edhha devices …");

  await Devices.create({
    device_id: "DEV-EDHHA-001", org_id: edhha_org_id,
    serial_no: "SN-EDHHA-001", model: "BIO-CHEQ (BQ-A1-01 Series)",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id: edhha_dept_id,
    assigned_to_user_id: edhhaTech.user_id,
    assigned_by_user_id: edhhaAdmin.user_id,
    assigned_at: new Date(),
  });

  await Devices.create({
    device_id: "DEV-EDHHA-002", org_id: edhha_org_id,
    serial_no: "SN-EDHHA-002", model: "Urine Analyzer (BK150)",
    status: "ACTIVE", firmware_version: "v1.2.0", department_id: edhha_dept_id,
    assigned_to_user_id: edhhaTech.user_id,
    assigned_by_user_id: edhhaAdmin.user_id,
    assigned_at: new Date(),
  });

  console.log(`   DEV-EDHHA-001 → edhha.tech  (BIO-CHEQ BQ-A1-01 — Blood)`);
  console.log(`   DEV-EDHHA-002 → edhha.tech  (Urine Analyzer BK150 — Urine)\n`);

  // ── 17. Create edhha test types (31 total) ────────────────────────────────────
  console.log("🔬 Creating edhha test types (custom plan) …");

  const edhhaCreated = await TestTypes.bulkCreate(buildTestTypeRows(EDHHA_TEST_TYPES, edhha_org_id), { returning: true });
  const edhhaByName = {};
  edhhaCreated.forEach(r => { edhhaByName[r.name] = r; });

  const edhhaBloodCount = EDHHA_TEST_TYPES.filter(t => t.specimen_type === "Blood").length;
  const edhhaUrineCount = EDHHA_TEST_TYPES.filter(t => t.specimen_type === "Urine").length;
  console.log(`   ${edhhaBloodCount} blood (custom subset) + ${edhhaUrineCount} urine = ${EDHHA_TEST_TYPES.length} total`);
  console.log(`   Excluded blood tests: S. Chloride, S. Magnesium, S. Phosphorus, S. Potassium, S. Sodium, S. Zinc\n`);

  // ── 18. Create edhha patients ─────────────────────────────────────────────────
  console.log("🧑‍⚕️ Creating edhha patients …");

  const edhhaPatients = [];
  for (const p of EDHHA_PATIENTS) {
    const patient = await Patients.create({
      patient_id: p.id, org_id: edhha_org_id,
      name: p.name, gender: p.gender, dob: p.dob, phone: p.phone, email: p.email,
      created_by: edhhaTech.user_id,
    });
    edhhaPatients.push({ ...patient.get({ plain: true }), gender: p.gender });
  }
  console.log(`   2 patients created (IDs 00006–00007)\n`);

  // ── 19. Create edhha sessions ─────────────────────────────────────────────────
  console.log("📋 Creating edhha sessions …");

  const [ep1, ep2] = edhhaPatients;

  // Session 1 — Ravi (Male), COMPLETED, blood panel using custom plan tests
  await makeSession({
    org_id: edhha_org_id, dept_id: edhha_dept_id, typeByName: edhhaByName,
    patient: ep1, performer: edhhaTech, device_id: "DEV-EDHHA-001",
    daysBack: 4, status: "COMPLETED", notes: "Annual blood check",
    tests: [
      { typeName: "Hb",            value_num: 14.5 }, // NORMAL (male 14–18)
      { typeName: "RBS",           value_num: 210  }, // HIGH (>200)
      { typeName: "HbA1C",         value_num: 6.8  }, // Diabetic (>6.5%)
      { typeName: "S. Creatinine", value_num: 1.1  }, // NORMAL (male ≤1.25)
    ],
  });

  // Session 2 — Lakshmi (Female), COMPLETED, urine analysis
  await makeSession({
    org_id: edhha_org_id, dept_id: edhha_dept_id, typeByName: edhhaByName,
    patient: ep2, performer: edhhaTech, device_id: "DEV-EDHHA-002",
    daysBack: 2, status: "COMPLETED", notes: "Routine urine",
    tests: [
      { typeName: "pH",  value_num: 6.0         },
      { typeName: "PRO", value_text: "Negative"  },
      { typeName: "BLO", value_text: "Negative"  },
      { typeName: "GLU", value_text: "Negative"  },
      { typeName: "LEU", value_text: "Negative"  },
    ],
  });

  // Session 3 — Lakshmi (Female), PENDING blood (no device yet)
  await makeSession({
    org_id: edhha_org_id, dept_id: edhha_dept_id, typeByName: edhhaByName,
    patient: ep2, performer: edhhaAdmin, device_id: null,
    daysBack: 1, status: "PENDING", notes: null,
    tests: [
      { typeName: "Hb"    },
      { typeName: "S. TC" },
      { typeName: "S. Triglycerides" },
    ],
  });

  console.log("   3 sessions (Blood: 1 · Urine: 2 · Pending: 3)\n");

  // Advance the sequence past the last seeded patient ID (00007)
  await sequelize.query(`SELECT setval('patients_id_seq', 7, true);`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  const [ciplRow] = await sequelize.query(
    `SELECT org_name, org_code FROM organizations WHERE org_id = :oid`,
    { replacements: { oid: org_id }, type: sequelize.QueryTypes.SELECT }
  );
  const [edhhaRow] = await sequelize.query(
    `SELECT org_name, org_code FROM organizations WHERE org_id = :oid`,
    { replacements: { oid: edhha_org_id }, type: sequelize.QueryTypes.SELECT }
  );

  console.log("🎉 Seed complete!\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" PLANS");
  console.log("   basic        — Urine tests only");
  console.log("   premium      — Full catalogue (all 37 tests)");
  console.log("   edhha_custom — 14 blood + 17 urine = 31 tests");
  console.log("");
  console.log(`─── ${ciplRow?.org_name}  #${String(ciplRow?.org_code).padStart(5, "0")}  [premium] ───`);
  console.log("  ADMIN accounts  (password: Demo@1234)");
  console.log(`    ${SEED_CONFIG.realAdmin.username.padEnd(12)} — ${SEED_CONFIG.realAdmin.name} (real admin)`);
  console.log("    admin.demo   — Demo Admin");
  console.log("  TECHNICIAN accounts  (password: Demo@1234)");
  console.log("    tech.raj     — Raj Kulkarni   (WORKING · both devices assigned)");
  console.log("    tech.meena   — Meena Iyer      (INACTIVE)");
  console.log("    tech.suresh  — Suresh Nair     (INACTIVE)");
  console.log("  Devices");
  console.log("    DEV-DEMO-001  BIO-CHEQ BQ-A1-01    → tech.raj  (Blood)");
  console.log("    DEV-DEMO-002  Urine Analyzer BK150 → tech.raj  (Urine)");
  console.log("  Patients : 5  (codes 00001–00005)");
  console.log("  Test types : 37  (20 blood + 17 urine)");
  console.log("  Sessions   : 5   (4 COMPLETED · 1 PENDING)");
  console.log("");
  console.log(`─── ${edhhaRow?.org_name}  #${String(edhhaRow?.org_code).padStart(5, "0")}  [edhha_custom] ───`);
  console.log("  ADMIN accounts  (password: Edhha@1234)");
  console.log("    edhha.admin  — Edhha Admin");
  console.log("  TECHNICIAN accounts  (password: Edhha@1234)");
  console.log("    edhha.tech   — Edhha Tech  (INACTIVE)");
  console.log("  Devices");
  console.log("    DEV-EDHHA-001  BIO-CHEQ BQ-A1-01    → edhha.tech  (Blood)");
  console.log("    DEV-EDHHA-002  Urine Analyzer BK150 → edhha.tech  (Urine)");
  console.log("  Patients : 2  (codes 00006–00007)");
  console.log("  Test types : 31  (14 blood custom subset + 17 urine)");
  console.log("  Sessions   : 3   (2 COMPLETED · 1 PENDING)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message || err);
  if (err.original) console.error("   DB detail:", err.original.detail || err.original.message);
  if (err.sql) console.error("   SQL:", err.sql.slice(0, 200));
  console.error(err.stack);
  process.exit(1);
});
