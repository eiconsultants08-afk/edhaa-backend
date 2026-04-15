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
 *   - 2 accounts  : admin.demo, tech.raj
 *   - 2 devices   : DEV-DEMO-001 (assigned), DEV-DEMO-002 (unassigned)
 *   - 5 patients  : fixed codes 00001–00005, fixed UUIDs
 *   - 8 test types: mix of numeric and qualitative
 *   - 5 sessions  : COMPLETED and PENDING to cover all app workflows
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
    code:     "EIPL01",           // unique slug — used to find/create the org
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
// DEMO DATA — fixed UUIDs and codes so rows are stable across all machines
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_USERNAMES = ["admin.demo", "tech.raj", "tech.meena", "tech.suresh"];

const PATIENTS = [
  { uuid: "b0000000-0000-4000-8000-000000000001", name: "Arjun Sharma",  gender: "MALE",   dob: "1980-04-12", phone: "9810011001", email: "arjun.sharma@mail.com"  },
  { uuid: "b0000000-0000-4000-8000-000000000002", name: "Preethi Nair",  gender: "FEMALE", dob: "1993-07-25", phone: "9810011002", email: "preethi.nair@mail.com"  },
  { uuid: "b0000000-0000-4000-8000-000000000003", name: "Mohammed Rafi", gender: "MALE",   dob: "1975-11-03", phone: "9810011003", email: "mohammed.rafi@mail.com" },
  { uuid: "b0000000-0000-4000-8000-000000000004", name: "Sunita Devi",   gender: "FEMALE", dob: "1988-02-18", phone: "9810011004", email: "sunita.devi@mail.com"   },
  { uuid: "b0000000-0000-4000-8000-000000000005", name: "Vikram Patel",  gender: "MALE",   dob: "1965-09-30", phone: "9810011005", email: "vikram.patel@mail.com"  },
];

// 8 test types: 5 numeric + 3 qualitative
const TEST_TYPES = [
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
    reference_text: "70–140 mg/dL",
    normal_min: 70, normal_max: 140, male_min: 70, male_max: 140, female_min: 70, female_max: 140,
    critical_low: 50, critical_high: 400, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "HbA1C", unit: "%", category: "Serum Biochemistry",
    method_options: ["Immunoturbidimetric Method"],
    reference_text: "Non-diabetic: <=5.6%\nPre-diabetic: 5.7–6.4%\nDiabetic: >=6.5%",
    normal_min: 0, normal_max: 5.6, male_min: 0, male_max: 5.6, female_min: 0, female_max: 5.6,
    critical_low: null, critical_high: null, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. Creatinine", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["Jaffe Method"],
    reference_text: "Male: 0.7–1.3 mg/dL\nFemale: 0.5–1.1 mg/dL",
    normal_min: 0.5, normal_max: 1.3, male_min: 0.7, male_max: 1.3, female_min: 0.5, female_max: 1.1,
    critical_low: null, critical_high: 10, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. TC", unit: "mg/dL", category: "Serum Biochemistry",
    method_options: ["CHOD-PAP Method"],
    reference_text: "Desirable: <200 mg/dL\nBorderline: 200–239 mg/dL\nHigh: >=240 mg/dL",
    normal_min: 0, normal_max: 200, male_min: 0, male_max: 200, female_min: 0, female_max: 200,
    critical_low: null, critical_high: 300, is_qualitative: false, specimen_type: "Blood",
  },
  {
    name: "S. HIV I & II", unit: "Positive/Negative", category: "Serum infection test",
    method_options: null,
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Blood",
  },
  {
    name: "S. HBsAg", unit: "Positive/Negative", category: "Serum infection test",
    method_options: null,
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Blood",
  },
  {
    name: "U. Cotinine", unit: "Positive/Negative", category: "Urine test",
    method_options: null,
    reference_text: "Negative",
    normal_min: null, normal_max: null, male_min: null, male_max: null, female_min: null, female_max: null,
    critical_low: null, critical_high: null, is_qualitative: true, specimen_type: "Urine",
  },
];

// Helper: date offset from today
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

  // ── Connect ─────────────────────────────────────────────────────────────────
  await sequelize.authenticate();
  console.log("✅ DB connected\n");

  // ── Sync models (creates missing tables on a fresh machine) ─────────────────
  await sequelize.sync();
  console.log("✅ Tables synced\n");

  // ── Schema patches (idempotent — all guarded with IF NOT EXISTS) ─────────────
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

  // ── 1. Upsert Org ────────────────────────────────────────────────────────────
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

  // ── 2. Upsert Department ─────────────────────────────────────────────────────
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

  // ── 3. Upsert real admin (always reset password) ─────────────────────────────
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

  // ── 4. Wipe demo data ────────────────────────────────────────────────────────
  // Delete org-scoped demo data first (safe order respecting FK constraints).
  console.log("🗑  Wiping demo data …");
  await sequelize.query(`DELETE FROM patient_test_results WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_histories      WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_types          WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM patients            WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM devices             WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM tokens              WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM users WHERE org_id = :oid AND role = 'TECHNICIAN'`, { replacements: { oid: org_id } });

  // Purge demo devices by device_id and serial_no across ALL orgs.
  // serial_no has a global unique constraint, so a device from a prior seed run
  // on another machine (different org_id) must be removed before re-inserting.
  await sequelize.query(
    `DELETE FROM devices WHERE device_id IN ('DEV-DEMO-001','DEV-DEMO-002') OR serial_no IN ('SN-DEMO-001','SN-DEMO-002')`
  );

  // Purge demo accounts by username — including any cross-org data they own.
  // This covers the case where the same usernames existed under a different org
  // on another machine (which would block user deletion via FK on patients.created_by).
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

  // ── 5. Reset patient_code sequence ──────────────────────────────────────────
  await sequelize.query(`SELECT setval('patients_patient_code_seq', 1, false);`);

  // ── 6. Create demo accounts ──────────────────────────────────────────────────
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

  const techMeena = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Meena Iyer", username: "tech.meena",
    email: "meena.iyer@demo.com", phone: "9900000102",
    password: hash, org_id, department_id, status: "ACTIVE",
  });

  const techSuresh = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Suresh Nair", username: "tech.suresh",
    email: "suresh.nair@demo.com", phone: "9900000103",
    password: hash, org_id, department_id, status: "INACTIVE",
  });

  console.log(`   admin.demo  / Demo@1234 — Demo Admin (ADMIN)`);
  console.log(`   tech.raj    / Demo@1234 — Raj Kulkarni  (TECHNICIAN · WORKING)`);
  console.log(`   tech.meena  / Demo@1234 — Meena Iyer    (TECHNICIAN · ACTIVE)`);
  console.log(`   tech.suresh / Demo@1234 — Suresh Nair   (TECHNICIAN · INACTIVE)\n`);

  // ── 7. Create devices ────────────────────────────────────────────────────────
  console.log("🖥  Creating devices …");

  await Devices.create({
    device_id: "DEV-DEMO-001", org_id,
    serial_no: "SN-DEMO-001", model: "BIO-CHEQ BQ-A1-01",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: techRaj.user_id,
    assigned_by_user_id: realAdmin.user_id,
    assigned_at: new Date(),
  });

  await Devices.create({
    device_id: "DEV-DEMO-002", org_id,
    serial_no: "SN-DEMO-002", model: "BIO-CHEQ BQ-A1-01",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: null,
    assigned_by_user_id: null,
    assigned_at: null,
  });

  console.log(`   DEV-DEMO-001 → tech.raj`);
  console.log(`   DEV-DEMO-002 → (unassigned)\n`);

  // ── 8. Create test types ─────────────────────────────────────────────────────
  console.log("🔬 Creating test types …");

  const createdTypes = await TestTypes.bulkCreate(
    TEST_TYPES.map(t => ({
      test_type_id:   randomUUID(),
      org_id,
      name:           t.name,
      unit:           t.unit,
      method:         t.method_options ? t.method_options[0] : null,
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

  // Build a name → row map for session creation below
  const typeByName = {};
  createdTypes.forEach(r => { typeByName[r.name] = r; });

  console.log(`   ${createdTypes.length} test types created\n`);

  // ── 9. Create patients ───────────────────────────────────────────────────────
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

  // ── 10. Create test sessions ─────────────────────────────────────────────────
  // 5 sessions covering all key app workflows:
  //   - Numeric + qualitative results
  //   - Abnormal values
  //   - PENDING session (shows pending workflow)
  //   - Patient with multiple sessions
  //   - Patient with no sessions (patient 5 — tests empty state)

  console.log("📋 Creating sessions …");

  const [p1, p2, p3, p4] = patients;  // p5 intentionally left with no sessions

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

    const rows = tests.map(({ typeName, value_num, value_text, method_used }) => {
      const tt = typeByName[typeName];
      if (!tt) throw new Error(`Unknown test type name: "${typeName}" — check TEST_TYPES array`);
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

  // Session 1 — patient 1, COMPLETED, basic blood panel
  await makeSession({
    patient: p1, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 5, status: "COMPLETED", notes: "Routine follow-up",
    tests: [
      { typeName: "Hb",   value_num: 15.2 },   // normal
      { typeName: "RBS",  value_num: 165 },     // abnormal (>140)
    ],
  });

  // Session 2 — patient 2, COMPLETED, diabetes check
  await makeSession({
    patient: p2, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 10, status: "COMPLETED", notes: "Diabetes management check",
    tests: [
      { typeName: "RBS",   value_num: 210 },    // abnormal
      { typeName: "HbA1C", value_num: 7.8 },    // abnormal (diabetic range)
    ],
  });

  // Session 3 — patient 2, second visit, COMPLETED, infection screen
  await makeSession({
    patient: p2, performer: demoAdmin, device_id: "DEV-DEMO-001",
    daysBack: 3, status: "COMPLETED", notes: "Pre-operative screening",
    tests: [
      { typeName: "Hb",          value_num: 11.5 },    // abnormal (below female min)
      { typeName: "S. HIV I & II", value_text: "NEGATIVE" },
      { typeName: "S. HBsAg",      value_text: "NEGATIVE" },
    ],
  });

  // Session 4 — patient 3, COMPLETED, full panel with abnormal creatinine
  await makeSession({
    patient: p3, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 2, status: "COMPLETED", notes: "Annual health check",
    tests: [
      { typeName: "Hb",           value_num: 13.8 },   // normal
      { typeName: "S. Creatinine", value_num: 1.9 },   // abnormal (>1.3)
      { typeName: "S. TC",         value_num: 182 },   // normal
      { typeName: "U. Cotinine",   value_text: "POSITIVE" },  // abnormal
    ],
  });

  // Session 5 — patient 4, PENDING (shows pending workflow — no result values)
  await makeSession({
    patient: p4, performer: techRaj, device_id: "DEV-DEMO-001",
    daysBack: 1, status: "PENDING", notes: null,
    tests: [
      { typeName: "Hb"   },
      { typeName: "RBS"  },
      { typeName: "HbA1C" },
    ],
  });

  console.log("   5 sessions created (4 COMPLETED · 1 PENDING)\n");

  // ── Done ─────────────────────────────────────────────────────────────────────
  const [orgRow] = await sequelize.query(
    `SELECT org_name, org_code FROM organizations WHERE org_id = :oid`,
    { replacements: { oid: org_id }, type: sequelize.QueryTypes.SELECT }
  );

  console.log("🎉 Seed complete!\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Organisation : ${orgRow?.org_name}  #${String(orgRow?.org_code).padStart(5, "0")}`);
  console.log(`  Department   : ${dept.department_name}`);
  console.log("");
  console.log("  ADMIN accounts  (password: Demo@1234)");
  console.log(`    ${SEED_CONFIG.realAdmin.username.padEnd(12)} — ${SEED_CONFIG.realAdmin.name} (real admin)`);
  console.log("    admin.demo   — Demo Admin (seed account)");
  console.log("");
  console.log("  TECHNICIAN accounts  (password: Demo@1234)");
  console.log("    tech.raj     — Raj Kulkarni  (WORKING · DEV-DEMO-001)");
  console.log("    tech.meena   — Meena Iyer     (ACTIVE)");
  console.log("    tech.suresh  — Suresh Nair    (INACTIVE)");
  console.log("");
  console.log("  Devices");
  console.log("    DEV-DEMO-001 → tech.raj");
  console.log("    DEV-DEMO-002 → unassigned");
  console.log("");
  console.log("  Patients : 5  (codes 00001–00005)");
  console.log("    00001 Arjun Sharma   — 1 session");
  console.log("    00002 Preethi Nair   — 2 sessions");
  console.log("    00003 Mohammed Rafi  — 1 session");
  console.log("    00004 Sunita Devi    — 1 session (PENDING)");
  console.log("    00005 Vikram Patel   — no sessions  ← tests empty state");
  console.log("");
  console.log("  Test types : 8  (5 numeric + 3 qualitative)");
  console.log("  Sessions   : 5  (4 COMPLETED · 1 PENDING)");
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message || err);
  process.exit(1);
});
