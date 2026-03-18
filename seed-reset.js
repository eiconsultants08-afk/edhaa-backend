/**
 * seed-reset.js — Resets the database to the original seed state.
 *
 * What it does:
 *   1. Clears ALL tokens          → logs everyone out
 *   2. Deletes ALL test results   → for the DEMO org
 *   3. Deletes ALL test sessions  → for the DEMO org
 *   4. Deletes ALL patients       → except Arun Mehta + Priya Nair
 *   5. Deletes ALL extra users    → keeps the 7 seed accounts only
 *   6. Resets device assignments  → original DEV-001–006 mapping
 *   7. Sets all technicians INACTIVE (no active sessions at reset time)
 *   8. Re-creates 3 seed sessions + 5 results for the 2 seed patients
 *
 * Run: node seed-reset.js
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Sequelize, DataTypes, Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

// ── DB connection ──────────────────────────────────────────────────────────────
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST ?? "localhost",
    dialect: "postgres",
    port: 5432,
    logging: false,
  }
);

// ── Minimal inline models ──────────────────────────────────────────────────────
const Organization = sequelize.define("organizations", {
  org_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.TEXT, unique: true },
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Users = sequelize.define("users", {
  user_id: { type: DataTypes.UUID, primaryKey: true },
  role: DataTypes.TEXT,
  username: { type: DataTypes.TEXT, unique: true },
  status: DataTypes.TEXT,
  org_id: DataTypes.UUID,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Devices = sequelize.define("devices", {
  device_id: { type: DataTypes.TEXT, primaryKey: true },
  org_id: DataTypes.UUID,
  serial_no: { type: DataTypes.TEXT, unique: true },
  model: DataTypes.TEXT,
  status: DataTypes.TEXT,
  firmware_version: DataTypes.TEXT,
  assigned_to_user_id: DataTypes.UUID,
  assigned_by_user_id: DataTypes.UUID,
  assigned_at: DataTypes.DATE,
  department_id: DataTypes.UUID,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Patients = sequelize.define("patients", {
  patient_id: { type: DataTypes.UUID, primaryKey: true },
  org_id: DataTypes.UUID,
  name: DataTypes.TEXT,
  gender: DataTypes.TEXT,
  dob: DataTypes.DATEONLY,
  address: DataTypes.TEXT,
  phone: DataTypes.TEXT,
  email: DataTypes.TEXT,
  created_by: DataTypes.UUID,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const TestHistory = sequelize.define("test_histories", {
  history_id: { type: DataTypes.UUID, primaryKey: true },
  patient_id: DataTypes.UUID,
  org_id: DataTypes.UUID,
  department_id: DataTypes.UUID,
  device_id: DataTypes.TEXT,
  entered_by_user_id: DataTypes.UUID,
  test_date: DataTypes.DATE,
  notes: DataTypes.TEXT,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const PatientTestResults = sequelize.define("patient_test_results", {
  result_id: { type: DataTypes.UUID, primaryKey: true },
  history_id: DataTypes.UUID,
  patient_id: DataTypes.UUID,
  org_id: DataTypes.UUID,
  test_type_id: DataTypes.UUID,
  value_num: DataTypes.DECIMAL,
  value_text: DataTypes.TEXT,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Tokens = sequelize.define("tokens", {
  token_id: { type: DataTypes.UUID, primaryKey: true },
  user_id: DataTypes.UUID,
  org_id: DataTypes.UUID,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const TestTypes = sequelize.define("test_types", {
  test_type_id: { type: DataTypes.UUID, primaryKey: true },
  org_id: DataTypes.UUID,
  name: DataTypes.TEXT,
}, { timestamps: false });

const Department = sequelize.define("department", {
  department_id: { type: DataTypes.UUID, primaryKey: true },
  department_name: DataTypes.TEXT,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

// ── Seed usernames / device IDs that must be preserved ────────────────────────
const SEED_USERNAMES = [
  "admin_demo",
  "tech_demo",
  "tech_001",
  "tech_002",
  "tech_003",
  "tech_004",
  "tech_005",
];

const SEED_PATIENT_NAMES = ["Arun Mehta", "Priya Nair"];

// ── Reset ──────────────────────────────────────────────────────────────────────
async function reset() {
  await sequelize.authenticate();
  console.log("✅ DB connected\n");

  // ── Resolve the DEMO org ───────────────────────────────────────────────────
  const org = await Organization.findOne({ where: { code: "DEMO" } });
  if (!org) {
    console.error("❌ DEMO org not found — run seed.js first");
    process.exit(1);
  }
  console.log("  org:", org.org_id);

  // ── Resolve department ─────────────────────────────────────────────────────
  const dept = await Department.findOne({ where: { department_name: "Pathology" } });
  if (!dept) {
    console.error("❌ Pathology department not found — run seed.js first");
    process.exit(1);
  }
  console.log("  dept:", dept.department_id);

  // ── 1. Clear ALL tokens (log everyone out) ─────────────────────────────────
  const tokensDeleted = await Tokens.destroy({ where: {} });
  console.log(`\n  🔑 Tokens cleared: ${tokensDeleted}`);

  // ── 2+3. Delete all test results + sessions for this org ───────────────────
  const resultsDeleted = await PatientTestResults.destroy({ where: { org_id: org.org_id } });
  console.log(`  🧪 Test results deleted: ${resultsDeleted}`);

  const sessionsDeleted = await TestHistory.destroy({ where: { org_id: org.org_id } });
  console.log(`  📋 Test sessions deleted: ${sessionsDeleted}`);

  // ── 4. Delete extra patients (keep only seed patients) ────────────────────
  const patientsDeleted = await Patients.destroy({
    where: {
      org_id: org.org_id,
      name: { [Op.notIn]: SEED_PATIENT_NAMES },
    },
  });
  console.log(`  🧑‍⚕️ Extra patients deleted: ${patientsDeleted}`);

  // ── 5. Delete extra users (keep only seed accounts) ───────────────────────
  const usersDeleted = await Users.destroy({
    where: {
      org_id: org.org_id,
      role: "TECHNICIAN",
      username: { [Op.notIn]: SEED_USERNAMES },
    },
  });
  console.log(`  👤 Extra technicians deleted: ${usersDeleted}`);

  // ── 6. Reset all seed technicians → INACTIVE ──────────────────────────────
  const [statusReset] = await Users.update(
    { status: "INACTIVE" },
    {
      where: {
        org_id: org.org_id,
        role: "TECHNICIAN",
        username: { [Op.in]: SEED_USERNAMES },
      },
    }
  );
  console.log(`  🔄 Technician statuses reset to INACTIVE: ${statusReset}`);

  // ── Resolve user IDs for seed accounts ───────────────────────────────────
  const seedUsers = await Users.findAll({
    where: { username: { [Op.in]: SEED_USERNAMES } },
    attributes: ["user_id", "username"],
  });

  const byUsername = {};
  for (const u of seedUsers) byUsername[u.username] = u.user_id;

  const adminId = byUsername["admin_demo"];
  const techDemoId = byUsername["tech_demo"];
  const tech001Id = byUsername["tech_001"];
  const tech002Id = byUsername["tech_002"];
  const tech003Id = byUsername["tech_003"];
  const tech004Id = byUsername["tech_004"];
  const tech005Id = byUsername["tech_005"];

  if (!adminId || !techDemoId) {
    console.error("❌ Seed accounts not found — run seed.js first");
    process.exit(1);
  }

  // ── 7. Restore device assignments ─────────────────────────────────────────
  const now = new Date();
  const deviceDefs = [
    { device_id: "DEV-001", serial_no: "SN-DEV-001", model: "BioAnalyzer X1",    assigned_to_user_id: techDemoId },
    { device_id: "DEV-002", serial_no: "SN-DEV-002", model: "BioAnalyzer X1",    assigned_to_user_id: tech001Id },
    { device_id: "DEV-003", serial_no: "SN-DEV-003", model: "BioAnalyzer X1",    assigned_to_user_id: tech003Id },
    { device_id: "DEV-004", serial_no: "SN-DEV-004", model: "BioAnalyzer X1",    assigned_to_user_id: tech002Id },
    { device_id: "DEV-005", serial_no: "SN-DEV-005", model: "BioAnalyzer X1",    assigned_to_user_id: tech004Id },
    { device_id: "DEV-006", serial_no: "SN-DEV-006", model: "BioAnalyzer X1",    assigned_to_user_id: tech005Id },
  ];

  for (const def of deviceDefs) {
    await Devices.upsert({
      ...def,
      org_id: org.org_id,
      department_id: dept.department_id,
      status: "ACTIVE",
      firmware_version: "v2.1.0",
      assigned_by_user_id: adminId,
      assigned_at: now,
    });
    console.log(`  📱 ${def.device_id} → ${SEED_USERNAMES.find(u => byUsername[u] === def.assigned_to_user_id)}`);
  }

  // ── 8. Re-create seed patients (upsert) ───────────────────────────────────
  const [p1] = await Patients.findOrCreate({
    where: { org_id: org.org_id, name: "Arun Mehta" },
    defaults: {
      patient_id: uuidv4(),
      org_id: org.org_id,
      name: "Arun Mehta",
      gender: "MALE",
      dob: "1985-06-15",
      address: "12 MG Road, Pune",
      phone: "9100000001",
      email: "arun@example.com",
      created_by: techDemoId,
    },
  });

  const [p2] = await Patients.findOrCreate({
    where: { org_id: org.org_id, name: "Priya Nair" },
    defaults: {
      patient_id: uuidv4(),
      org_id: org.org_id,
      name: "Priya Nair",
      gender: "FEMALE",
      dob: "1993-11-22",
      address: "45 FC Road, Pune",
      phone: "9100000002",
      email: "priya@example.com",
      created_by: techDemoId,
    },
  });
  console.log(`\n  👥 Patients: ${p1.patient_id}  ${p2.patient_id}`);

  // ── 9. Resolve test type IDs (Haemoglobin, Blood Glucose, Total Cholesterol) ─
  const testTypes = await TestTypes.findAll({
    where: {
      org_id: org.org_id,
      name: { [Op.in]: ["Haemoglobin", "Blood Glucose (Fasting)", "Total Cholesterol"] },
    },
    attributes: ["test_type_id", "name"],
  });

  const ttByName = {};
  for (const tt of testTypes) ttByName[tt.name] = tt.test_type_id;

  const haemId  = ttByName["Haemoglobin"];
  const glucId  = ttByName["Blood Glucose (Fasting)"];
  const cholId  = ttByName["Total Cholesterol"];

  if (!haemId || !glucId || !cholId) {
    console.error("❌ Seed test types not found — run seed.js first");
    process.exit(1);
  }

  // ── 10. Re-create 3 seed sessions + 5 results ─────────────────────────────
  const sessionNow = new Date();
  const yesterday = new Date(sessionNow - 86400000);

  const sessions = [
    {
      patient: p1, date: sessionNow, notes: "Routine checkup",
      results: [
        { test_type_id: haemId, value_num: 12.4 },
        { test_type_id: glucId, value_num: 95 },
      ],
    },
    {
      patient: p1, date: yesterday, notes: "Follow-up",
      results: [
        { test_type_id: cholId, value_num: 215 },
      ],
    },
    {
      patient: p2, date: sessionNow, notes: "Initial visit",
      results: [
        { test_type_id: haemId, value_num: 10.1 },
        { test_type_id: glucId, value_num: 88 },
      ],
    },
  ];

  for (const session of sessions) {
    const history = await TestHistory.create({
      history_id: uuidv4(),
      patient_id: session.patient.patient_id,
      org_id: org.org_id,
      department_id: dept.department_id,
      device_id: "DEV-001",
      entered_by_user_id: techDemoId,
      test_date: session.date,
      notes: session.notes || null,
    });
    for (const r of session.results) {
      await PatientTestResults.create({
        result_id: uuidv4(),
        history_id: history.history_id,
        patient_id: session.patient.patient_id,
        org_id: org.org_id,
        test_type_id: r.test_type_id,
        value_num: r.value_num,
      });
    }
  }
  console.log("  📊 Test sessions + results: restored (3 sessions, 5 results)\n");

  console.log("✅ Reset complete.\n");
  console.log("════════════════════════════════════════");
  console.log("  SUB ADMIN");
  console.log("  username : admin_demo   password : Admin@123");
  console.log("════════════════════════════════════════");
  console.log("  TECHNICIANS (all INACTIVE — no active sessions)");
  console.log("  username : tech_demo    password : Tech@123   device: DEV-001");
  console.log("  username : tech_001     password : Tech@123   device: DEV-002");
  console.log("  username : tech_002     password : Tech@123   device: DEV-004");
  console.log("  username : tech_003     password : Tech@123   device: DEV-003");
  console.log("  username : tech_004     password : Tech@123   device: DEV-005");
  console.log("  username : tech_005     password : Tech@123   device: DEV-006");
  console.log("════════════════════════════════════════");
  console.log("  PATIENTS");
  console.log("  Arun Mehta  (MALE,   DOB: 1985-06-15)  — 2 sessions");
  console.log("  Priya Nair  (FEMALE, DOB: 1993-11-22)  — 1 session");
  console.log("════════════════════════════════════════\n");

  await sequelize.close();
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
