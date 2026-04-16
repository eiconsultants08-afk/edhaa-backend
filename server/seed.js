/**
 * EDHHA Demo Seed
 *
 * Works on a fresh machine (blank DB) or an existing one.
 * Edit SEED_CONFIG to match your environment — everything else is automatic.
 *
 * Creates / upserts (safe to run multiple times):
 *   - Organisation, Department, real Admin  (from SEED_CONFIG)
 *
 * Wipes and recreates demo data every run:
 *   - 4 accounts  : admin.demo, tech.raj (WORKING), tech.meena (INACTIVE), tech.suresh (INACTIVE)
 *   - 2 devices   : DEV-DEMO-001 BIO-CHEQ (blood), DEV-DEMO-002 BK150 (urine) — both assigned to tech.raj
 *   - 5 patients  : fixed codes 00001–00005, fixed UUIDs
 *   - 37 test types: 20 blood (Sheet1 non-calculated) + 17 urine (Sheet2)
 *   - 5 sessions  : blood + urine + PENDING to cover all app workflows
 *
 * Run:  node server/seed.js
 * Password for all accounts: Demo@1234
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
// DEMO DATA
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_USERNAMES = ["admin.demo", "tech.raj", "tech.meena", "tech.suresh"];

const PATIENTS = [
  { uuid: "b0000000-0000-4000-8000-000000000001", name: "Arjun Sharma",  gender: "MALE",   dob: "1980-04-12", phone: "9810011001", email: "arjun.sharma@mail.com"  },
  { uuid: "b0000000-0000-4000-8000-000000000002", name: "Preethi Nair",  gender: "FEMALE", dob: "1993-07-25", phone: "9810011002", email: "preethi.nair@mail.com"  },
  { uuid: "b0000000-0000-4000-8000-000000000003", name: "Mohammed Rafi", gender: "MALE",   dob: "1975-11-03", phone: "9810011003", email: "mohammed.rafi@mail.com" },
  { uuid: "b0000000-0000-4000-8000-000000000004", name: "Sunita Devi",   gender: "FEMALE", dob: "1988-02-18", phone: "9810011004", email: "sunita.devi@mail.com"   },
  { uuid: "b0000000-0000-4000-8000-000000000005", name: "Vikram Patel",  gender: "MALE",   dob: "1965-09-30", phone: "9810011005", email: "vikram.patel@mail.com"  },
];

// ── Blood tests — Sheet1, non-calculated only (20 tests) ─────────────────────

const BLOOD_TESTS = [
  {
    name: "Hb", unit: "g/dL", category: "Haemogram biochemistry",
    method_options: ["Alkaline Hematin D Method"],
    reference_text: "Male: 14–18 g/dL\nFemale: 12–16 g/dL",
    normal_min: 12, normal_max: 18, male_min: 14, male_max: 18, female_min: 12, female_max: 16,
    critical_low: 7, critical_high: 20, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "RBS", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["GOD-POD Method"],
    reference_text: "Normal: <200 mg/dL\nDiabetes mellitus: >200 mg/dL",
    normal_min: null, normal_max: 200, male_min: null, male_max: 200, female_min: null, female_max: 200,
    critical_low: 60, critical_high: 300, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Creatinine", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Modified Jaffe Method"],
    reference_text: "Male: 0.66–1.25 mg/dL\nFemale: 0.52–1.04 mg/dL",
    normal_min: 0.52, normal_max: 1.25, male_min: 0.66, male_max: 1.25, female_min: 0.52, female_max: 1.04,
    critical_low: null, critical_high: 5, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Urea", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Berthlot Endpoint Method"],
    reference_text: "Male: 19–43 mg/dL\nFemale: 20–36 mg/dL",
    normal_min: 19, normal_max: 43, male_min: 19, male_max: 43, female_min: 20, female_max: 36,
    critical_low: null, critical_high: 100, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Uric Acid", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Uricase-POD Method"],
    reference_text: "Male: 3.5–8.5 mg/dL\nFemale: 2.5–6.2 mg/dL",
    normal_min: 2.5, normal_max: 8.5, male_min: 3.5, male_max: 8.5, female_min: 2.5, female_max: 6.2,
    critical_low: null, critical_high: 13, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Total Bilirubin", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Diazo Method"],
    reference_text: "0–1.2 mg/dL",
    normal_min: 0, normal_max: 1.2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 15, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Direct Bilirubin", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Diazo Method"],
    reference_text: "0–0.3 mg/dL",
    normal_min: 0, normal_max: 0.3, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 5, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Albumin", unit: "g/dL", category: "Serum Biochemistry",
    method_options: ["Bromocresol Green Method"],
    reference_text: "3.5–5.2 g/dL",
    normal_min: 3.5, normal_max: 5.2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 2, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. TP", unit: "g/dL", category: "Serum Biochemistry",
    method_options: ["Biuret Method"],
    reference_text: "6.0–8.3 g/dL",
    normal_min: 6.0, normal_max: 8.3, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 4, critical_high: 10, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Calcium", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Arsenazo III Method"],
    reference_text: "8.4–10.2 mg/dL",
    normal_min: 8.4, normal_max: 10.2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 6.5, critical_high: 13, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. TC", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["CHOD-POD Method"],
    reference_text: "Desirable: <200 mg/dL\nBorderline High: 200–239 mg/dL\nHigh: ≥240 mg/dL",
    normal_min: null, normal_max: 200, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 300, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Triglycerides", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["GPO-POD Method"],
    reference_text: "Normal: <150 mg/dL\nBorderline High: 150–199 mg/dL\nHigh: 200–499 mg/dL\nVery High: ≥500 mg/dL",
    normal_min: null, normal_max: 150, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 500, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. HDL-C", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Polymer-Detergent Method"],
    reference_text: ">40 mg/dL",
    normal_min: 40, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 20, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "HbA1C", unit: "%", category: "Serum Biochemistry",
    method_options: ["Immunoturbidimetric Method"],
    reference_text: "Non-diabetic: ≤5.6%\nPre-diabetic: 5.7–6.4%\nDiabetic: ≥6.5%",
    normal_min: null, normal_max: 5.6, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Sodium", unit: "mmol/L", category: "Serum Biochemistry",
    method_options: ["Colorimetric Method"],
    reference_text: "136–145 mmol/L",
    normal_min: 136, normal_max: 145, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 120, critical_high: 160, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Potassium", unit: "mmol/L", category: "Serum Biochemistry",
    method_options: ["Colorimetric Method"],
    reference_text: "3.5–5.1 mmol/L",
    normal_min: 3.5, normal_max: 5.1, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 2.5, critical_high: 6.5, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Chloride", unit: "mmol/L", category: "Serum Biochemistry",
    method_options: ["Thiocyanate Method"],
    reference_text: "98–109 mmol/L",
    normal_min: 98, normal_max: 109, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 80, critical_high: 115, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Magnesium", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Xylidyl Blue Method"],
    reference_text: "1.6–3.0 mg/dL",
    normal_min: 1.6, normal_max: 3.0, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 1.0, critical_high: 4.0, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Phosphorus", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Ammonium Molybdate Method"],
    reference_text: "2.5–4.5 mg/dL",
    normal_min: 2.5, normal_max: 4.5, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: 1.0, critical_high: 7.0, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Zinc", unit: "µg/dL", category: "Serum Biochemistry",
    method_options: ["Bromo PAPS Method"],
    reference_text: "60–120 µg/dL",
    normal_min: 60, normal_max: 120, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
];

// ── Urine tests — Sheet2, all 17 tests ───────────────────────────────────────
// Qualitative (is_qualitative: true) → Positive/Negative result buttons in app
// Quantitative (is_qualitative: false) → numeric input

const URINE_TESTS = [
  {
    name: "Colour", unit: "", category: "Urine test",
    method_options: ["Visual Method"],
    reference_text: "Pale Yellow",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "Transparency", unit: "", category: "Urine test",
    method_options: ["Visual Method"],
    reference_text: "Clear",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "pH", unit: "", category: "Urine test",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "5.0–8.0",
    normal_min: 5.0, normal_max: 8.0, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "SG", unit: "", category: "Urine test",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "1.003–1.030",
    normal_min: 1.003, normal_max: 1.030, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "LEU", unit: "cell/μL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative to Trace",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "URO", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "0.2–1.0 mg/dL",
    normal_min: 0.2, normal_max: 1.0, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "ALB", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "<2 mg/dL",
    normal_min: null, normal_max: 2, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "PRO", unit: "g/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 1, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "BIL", unit: "µmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "GLU", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "ASC", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative to Low",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "KET", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "NIT", unit: "mmol/L", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "CRE", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "1.13–10.18 mg/dL",
    normal_min: 1.13, normal_max: 10.18, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "BLO", unit: "cell/μL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
  {
    name: "CA", unit: "mg/dL", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "10–30 mg/dL",
    normal_min: 10, normal_max: 30, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Urine",
  },
  {
    name: "ACR", unit: "mg/g", category: "MSU (Urine Biochemistry)",
    method_options: ["Urine Dip Strip Method"],
    reference_text: "<30 mg/g",
    normal_min: null, normal_max: 30, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: 300, is_qualitative: false, specimen_type: "Urine",
  },
];

const TEST_TYPES = [...BLOOD_TESTS, ...URINE_TESTS];

// ── Helper ────────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {

  // ── Connect ──────────────────────────────────────────────────────────────────
  await sequelize.authenticate();
  console.log("✅ DB connected\n");

  // ── Sync (creates missing tables on fresh machine) ────────────────────────────
  await sequelize.sync();
  console.log("✅ Tables synced\n");

  // ── Schema patches (idempotent) ───────────────────────────────────────────────
  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS patients_patient_code_seq START 1;`);
  await sequelize.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_code INTEGER;`);
  await sequelize.query(`ALTER TABLE patients ALTER COLUMN patient_code SET DEFAULT nextval('patients_patient_code_seq');`);
  await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS patients_patient_code_unique ON patients(patient_code);`);

  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS organizations_org_code_seq START 1;`);
  await sequelize.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code INTEGER;`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN org_code SET DEFAULT nextval('organizations_org_code_seq');`);

  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS category TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS method_options JSONB;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS reference_text TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_low FLOAT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_high FLOAT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS is_qualitative BOOLEAN NOT NULL DEFAULT false;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS specimen_type TEXT;`);
  await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);

  await sequelize.query(`ALTER TABLE patient_test_results ADD COLUMN IF NOT EXISTS method_used TEXT;`);
  await sequelize.query(`ALTER TABLE patient_test_results ADD COLUMN IF NOT EXISTS patient_code INTEGER;`);

  await sequelize.query(`DO $$ BEGIN CREATE TYPE enum_test_history_status AS ENUM ('PENDING','COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await sequelize.query(`ALTER TABLE test_histories ADD COLUMN IF NOT EXISTS status enum_test_history_status NOT NULL DEFAULT 'PENDING';`);
  await sequelize.query(`ALTER TABLE test_histories ADD COLUMN IF NOT EXISTS patient_code INTEGER;`);

  await sequelize.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);

  console.log("✅ Schema patches applied\n");

  // ── 1. Upsert Org ─────────────────────────────────────────────────────────────
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
    })).get({ plain: true });
  } else {
    console.log(`📌 Org found: "${org.org_name}"`);
  }
  const org_id = org.org_id;
  await sequelize.query(
    `UPDATE organizations SET org_code = nextval('organizations_org_code_seq') WHERE org_id = :oid AND org_code IS NULL`,
    { replacements: { oid: org_id } }
  );

  // ── 2. Upsert Department ──────────────────────────────────────────────────────
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

  // ── 3. Upsert real admin ──────────────────────────────────────────────────────
  const hash = await bcrypt.hash("Demo@1234", 10);

  let realAdmin = await Users.findOne({ where: { username: SEED_CONFIG.realAdmin.username }, raw: true });
  if (!realAdmin) {
    console.log(`👤 Creating real admin "${SEED_CONFIG.realAdmin.username}" …`);
    realAdmin = (await Users.create({
      user_id: randomUUID(), role: "ADMIN",
      name:     SEED_CONFIG.realAdmin.name,
      username: SEED_CONFIG.realAdmin.username,
      email:    SEED_CONFIG.realAdmin.email,
      phone:    SEED_CONFIG.realAdmin.phone,
      password: hash, org_id, department_id, status: "ACTIVE",
    })).get({ plain: true });
  } else {
    await sequelize.query(
      `UPDATE users SET password = :pw, org_id = :oid, department_id = :did WHERE user_id = :uid`,
      { replacements: { pw: hash, oid: org_id, did: department_id, uid: realAdmin.user_id } }
    );
    console.log(`📌 Real admin found: "${realAdmin.username}" (password reset)`);
  }
  console.log("");

  // ── 4. Wipe demo data ─────────────────────────────────────────────────────────
  console.log("🗑  Wiping demo data …");
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

  // Cross-org user cleanup (covers data owned by demo accounts under a different org on this RDS)
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

  // ── 5. Reset patient_code sequence ────────────────────────────────────────────
  await sequelize.query(`SELECT setval('patients_patient_code_seq', 1, false);`);

  // ── 6. Create demo accounts ───────────────────────────────────────────────────
  console.log("👤 Creating accounts …");

  const demoAdmin = await Users.create({
    user_id: randomUUID(), role: "ADMIN",
    name: "Demo Admin", username: "admin.demo",
    email: "admin.demo@demo.com", phone: "9900000001",
    password: hash, org_id, department_id, status: "ACTIVE",
  });

  const techRaj = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Raj Kulkarni", username: "tech.raj",
    email: "raj.kulkarni@demo.com", phone: "9900000101",
    password: hash, org_id, department_id, status: "WORKING",
  });

  await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Meena Iyer", username: "tech.meena",
    email: "meena.iyer@demo.com", phone: "9900000102",
    password: hash, org_id, department_id, status: "INACTIVE",
  });

  await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Suresh Nair", username: "tech.suresh",
    email: "suresh.nair@demo.com", phone: "9900000103",
    password: hash, org_id, department_id, status: "INACTIVE",
  });

  console.log(`   admin.demo  / Demo@1234 — Demo Admin     (ADMIN)`);
  console.log(`   tech.raj    / Demo@1234 — Raj Kulkarni   (TECHNICIAN · WORKING)`);
  console.log(`   tech.meena  / Demo@1234 — Meena Iyer     (TECHNICIAN · INACTIVE)`);
  console.log(`   tech.suresh / Demo@1234 — Suresh Nair    (TECHNICIAN · INACTIVE)\n`);

  // ── 7. Create devices ─────────────────────────────────────────────────────────
  console.log("🖥  Creating devices …");

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

  // ── 8. Create test types (37 total) ───────────────────────────────────────────
  console.log("🔬 Creating test types …");

  const createdTypes = await TestTypes.bulkCreate(
    TEST_TYPES.map(t => ({
      test_type_id:   randomUUID(),
      org_id,
      name:           t.name,
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
    })),
    { returning: true }
  );

  const typeByName = {};
  createdTypes.forEach(r => { typeByName[r.name] = r; });

  const bloodCount = BLOOD_TESTS.length;
  const urineCount = URINE_TESTS.length;
  console.log(`   ${bloodCount} blood test types + ${urineCount} urine test types = ${bloodCount + urineCount} total\n`);

  // ── 9. Create patients ────────────────────────────────────────────────────────
  console.log("🧑‍⚕️ Creating patients …");

  const patients = [];
  for (const p of PATIENTS) {
    const code = await sequelize.query(
      `SELECT nextval('patients_patient_code_seq')::int AS val`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const patient = await Patients.create({
      patient_id:   p.uuid,
      patient_code: code[0].val,
      org_id,
      name:         p.name,
      gender:       p.gender,
      dob:          p.dob,
      phone:        p.phone,
      email:        p.email,
      created_by:   techRaj.user_id,
    });
    patients.push({ ...patient.get({ plain: true }), gender: p.gender });
  }

  console.log(`   5 patients created (codes 00001–00005)\n`);

  // ── 10. Create test sessions ──────────────────────────────────────────────────
  console.log("📋 Creating sessions …");

  const [p1, p2, p3, p4] = patients;  // p5 left with no sessions (tests empty state)

  async function makeSession({ patient, performer, device_id, daysBack, status, notes, tests }) {
    const history = await TestHistory.create({
      history_id:         randomUUID(),
      patient_id:         patient.patient_id,
      patient_code:       patient.patient_code,
      org_id,
      department_id,
      device_id,
      entered_by_user_id: performer.user_id,
      test_date:          daysAgo(daysBack),
      status,
      notes: status === "PENDING" ? null : notes,
    });

    const rows = tests.map(({ typeName, value_num, value_text }) => {
      const tt = typeByName[typeName];
      if (!tt) throw new Error(`Unknown test type name: "${typeName}" — check TEST_TYPES`);
      return {
        result_id:    randomUUID(),
        history_id:   history.history_id,
        patient_id:   patient.patient_id,
        patient_code: patient.patient_code,
        org_id,
        test_type_id: tt.test_type_id,
        value_num:    status === "PENDING" ? null : (value_num ?? null),
        value_text:   status === "PENDING" ? null : (value_text ?? null),
        method_used:  tt.method_options?.[0] ?? null,
      };
    });

    await PatientTestResults.bulkCreate(rows);
    return history;
  }

  // Session 1 — Arjun (Male), COMPLETED, blood panel
  await makeSession({
    patient: p1, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 5, status: "COMPLETED", notes: "Routine follow-up",
    tests: [
      { typeName: "Hb",  value_num: 15.2 },   // NORMAL (male 14–18)
      { typeName: "RBS", value_num: 225 },     // HIGH (>200)
    ],
  });

  // Session 2 — Preethi (Female), COMPLETED, diabetes check (blood)
  await makeSession({
    patient: p2, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 10, status: "COMPLETED", notes: "Diabetes management check",
    tests: [
      { typeName: "RBS",   value_num: 180 },   // NORMAL (<200)
      { typeName: "HbA1C", value_num: 7.8 },   // HIGH (>5.6%, diabetic range)
    ],
  });

  // Session 3 — Preethi (Female), COMPLETED, urine analysis (second visit)
  await makeSession({
    patient: p2, performer: demoAdmin, device_id: "DEV-DEMO-002",
    daysBack: 3, status: "COMPLETED", notes: "Urine routine",
    tests: [
      { typeName: "pH",  value_num: 6.5 },        // NORMAL (5.0–8.0)
      { typeName: "PRO", value_text: "Negative" }, // Normal
      { typeName: "BLO", value_text: "Positive" }, // Abnormal
      { typeName: "GLU", value_text: "Negative" }, // Normal
    ],
  });

  // Session 4 — Mohammed (Male), COMPLETED, renal/lipid panel (blood)
  await makeSession({
    patient: p3, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 2, status: "COMPLETED", notes: "Annual health check",
    tests: [
      { typeName: "Hb",           value_num: 13.8 }, // NORMAL (male 14–18) → LOW actually (13.8 < 14)
      { typeName: "S. Creatinine", value_num: 1.9 }, // HIGH (>1.25 for male)
      { typeName: "S. TC",         value_num: 255 }, // HIGH (>200)
    ],
  });

  // Session 5 — Sunita (Female), PENDING (no values, no device selected yet)
  await makeSession({
    patient: p4, performer: techRaj, device_id: null,
    daysBack: 1, status: "PENDING", notes: null,
    tests: [
      { typeName: "Hb"    },
      { typeName: "RBS"   },
      { typeName: "HbA1C" },
    ],
  });

  console.log("   5 sessions (Blood: 1,2,4 · Urine: 3 · Pending: 5)\n");

  // ── Done ─────────────────────────────────────────────────────────────────────
  const [orgRow] = await sequelize.query(
    `SELECT org_name, org_code FROM organizations WHERE org_id = :oid`,
    { replacements: { oid: org_id }, type: sequelize.QueryTypes.SELECT }
  );

  console.log("🎉 Seed complete!\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Organisation : ${orgRow?.org_name}  #${String(orgRow?.org_code).padStart(5, "0")}`);
  console.log(`  Department   : ${dept.department_name}`);
  console.log("");
  console.log("  ADMIN accounts  (password: Demo@1234)");
  console.log(`    ${SEED_CONFIG.realAdmin.username.padEnd(12)} — ${SEED_CONFIG.realAdmin.name} (real admin)`);
  console.log("    admin.demo   — Demo Admin (seed account)");
  console.log("");
  console.log("  TECHNICIAN accounts  (password: Demo@1234)");
  console.log("    tech.raj     — Raj Kulkarni   (WORKING · both devices assigned)");
  console.log("    tech.meena   — Meena Iyer      (INACTIVE)");
  console.log("    tech.suresh  — Suresh Nair     (INACTIVE)");
  console.log("");
  console.log("  Devices");
  console.log("    DEV-DEMO-001  BIO-CHEQ BQ-A1-01      → tech.raj  (Blood)");
  console.log("    DEV-DEMO-002  Urine Analyzer BK150   → tech.raj  (Urine)");
  console.log("");
  console.log("  Patients : 5  (codes 00001–00005)");
  console.log("    00001 Arjun Sharma   — 1 blood session");
  console.log("    00002 Preethi Nair   — 2 sessions (blood + urine)");
  console.log("    00003 Mohammed Rafi  — 1 blood session");
  console.log("    00004 Sunita Devi    — 1 PENDING session");
  console.log("    00005 Vikram Patel   — no sessions  ← tests empty state");
  console.log("");
  console.log("  Test types : 37  (20 blood + 17 urine)");
  console.log("  Sessions   : 5   (4 COMPLETED · 1 PENDING)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message || err);
  process.exit(1);
});
