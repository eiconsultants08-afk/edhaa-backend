/**
 * Seed script — creates test data in edha_local for local development.
 * Run: node seed.js
 *
 * Creates:
 *   Organization: Demo Diagnostics (code: DEMO)
 *   Department:   Pathology
 *   Admin:        username=admin_demo  password=Admin@123
 *   Technician:   username=tech_demo   password=Tech@123
 *   Device:       device_id=DEV-001 (assigned to technician)
 *   TestTypes:    Haemoglobin, Blood Glucose, Cholesterol
 *   Patients:     2 sample patients with test results
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcrypt";
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

// ── Minimal inline models (no cross-module imports needed) ─────────────────────
const Organization = sequelize.define("organizations", {
  org_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  org_name: DataTypes.TEXT,
  address: DataTypes.TEXT,
  phone: DataTypes.TEXT,
  email: DataTypes.TEXT,
  code: { type: DataTypes.TEXT, unique: true },
  status: { type: DataTypes.TEXT, defaultValue: "ACTIVE" },
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Department = sequelize.define("department", {
  department_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  department_name: DataTypes.TEXT,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Users = sequelize.define("users", {
  user_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  role: DataTypes.TEXT,
  name: DataTypes.TEXT,
  email: { type: DataTypes.TEXT, unique: true },
  username: { type: DataTypes.TEXT, unique: true },
  phone: DataTypes.TEXT,
  password: DataTypes.TEXT,
  org_id: DataTypes.UUID,
  department_id: DataTypes.UUID,
  status: { type: DataTypes.TEXT, defaultValue: "ACTIVE" },
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Devices = sequelize.define("devices", {
  device_id: { type: DataTypes.TEXT, primaryKey: true },
  org_id: DataTypes.UUID,
  serial_no: { type: DataTypes.TEXT, unique: true },
  model: DataTypes.TEXT,
  status: { type: DataTypes.TEXT, defaultValue: "ACTIVE" },
  firmware_version: DataTypes.TEXT,
  assigned_to_user_id: DataTypes.UUID,
  assigned_by_user_id: DataTypes.UUID,
  assigned_at: DataTypes.DATE,
  department_id: DataTypes.UUID,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const TestTypes = sequelize.define("test_types", {
  test_type_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  org_id: DataTypes.UUID,
  name: DataTypes.TEXT,
  unit: DataTypes.TEXT,
  method: DataTypes.TEXT,
  normal_min: DataTypes.DECIMAL,
  normal_max: DataTypes.DECIMAL,
  male_min: DataTypes.DECIMAL,
  male_max: DataTypes.DECIMAL,
  female_min: DataTypes.DECIMAL,
  female_max: DataTypes.DECIMAL,
  threshold_operator: DataTypes.TEXT,
  threshold_value: DataTypes.DECIMAL,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const Patients = sequelize.define("patients", {
  patient_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
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
  history_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  patient_id: DataTypes.UUID,
  org_id: DataTypes.UUID,
  department_id: DataTypes.UUID,
  device_id: DataTypes.TEXT,
  entered_by_user_id: DataTypes.UUID,
  test_date: DataTypes.DATE,
  notes: DataTypes.TEXT,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

const PatientTestResults = sequelize.define("patient_test_results", {
  result_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  history_id: DataTypes.UUID,
  patient_id: DataTypes.UUID,
  org_id: DataTypes.UUID,
  test_type_id: DataTypes.UUID,
  value_num: DataTypes.DECIMAL,
  value_text: DataTypes.TEXT,
}, { timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

// ── Seed ───────────────────────────────────────────────────────────────────────
async function seed() {
  await sequelize.authenticate();
  console.log("✅ DB connected");

  // Sync tables (create if not exist, no drop)
  await sequelize.sync();

  // Apply schema changes that plain sync() won't do on existing tables
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS test_histories (
      history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      org_id UUID NOT NULL,
      department_id UUID,
      device_id TEXT,
      entered_by_user_id UUID NOT NULL,
      test_date TIMESTAMPTZ NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await sequelize.query(`
    ALTER TABLE patient_test_results
      ADD COLUMN IF NOT EXISTS history_id UUID,
      DROP COLUMN IF EXISTS department_id,
      DROP COLUMN IF EXISTS device_id,
      DROP COLUMN IF EXISTS entered_by_user_id,
      DROP COLUMN IF EXISTS test_date,
      DROP COLUMN IF EXISTS notes;
  `);
  console.log("  schema migrations applied");

  const SALT = 10;

  // 1. Organization
  const [org] = await Organization.findOrCreate({
    where: { code: "DEMO" },
    defaults: {
      org_id: uuidv4(),
      org_name: "Demo Diagnostics",
      address: "123 Health Street, Mumbai",
      phone: "9000000001",
      email: "info@demodx.com",
      status: "ACTIVE",
    },
  });
  console.log("  org:", org.org_id);

  // 2. Department
  const [dept] = await Department.findOrCreate({
    where: { department_name: "Pathology" },
    defaults: { department_id: uuidv4(), department_name: "Pathology" },
  });
  console.log("  dept:", dept.department_id);

  // 3. Admin user
  const adminHash = await bcrypt.hash("Admin@123", SALT);
  const [admin] = await Users.findOrCreate({
    where: { username: "admin_demo" },
    defaults: {
      user_id: uuidv4(),
      role: "ADMIN",
      name: "Demo Admin",
      email: "admin@demodx.com",
      username: "admin_demo",
      phone: "8000000001",
      password: adminHash,
      org_id: org.org_id,
      department_id: dept.department_id,
      status: "ACTIVE",
    },
  });
  console.log("  admin:", admin.user_id);

  // 4. Technician user
  const techHash = await bcrypt.hash("Tech@123", SALT);
  const [tech] = await Users.findOrCreate({
    where: { username: "tech_demo" },
    defaults: {
      user_id: uuidv4(),
      role: "TECHNICIAN",
      name: "Riya Sharma",
      email: "riya@demodx.com",
      username: "tech_demo",
      phone: "8000000002",
      password: techHash,
      org_id: org.org_id,
      department_id: dept.department_id,
      status: "ACTIVE",
    },
  });
  console.log("  technician:", tech.user_id);

  // 4b. Additional technicians
  const techHash2 = await bcrypt.hash("Tech@123", SALT);

  const techDefs = [
    { username: "tech_001", name: "Arjun Patel",    email: "arjun@demodx.com",  phone: "8000000003" },
    { username: "tech_002", name: "Sneha Kulkarni", email: "sneha@demodx.com",  phone: "8000000004" },
    { username: "tech_003", name: "Karan Verma",    email: "karan@demodx.com",  phone: "8000000005" },
    { username: "tech_004", name: "Divya Menon",    email: "divya@demodx.com",  phone: "8000000006" },
    { username: "tech_005", name: "Priya Das",      email: "priya.das@demodx.com", phone: "8000000007" },
  ];

  const extraTechs = [];
  for (const def of techDefs) {
    const [t] = await Users.findOrCreate({
      where: { username: def.username },
      defaults: {
        user_id: uuidv4(),
        role: "TECHNICIAN",
        name: def.name,
        email: def.email,
        username: def.username,
        phone: def.phone,
        password: techHash2,
        org_id: org.org_id,
        department_id: dept.department_id,
        status: "ACTIVE",
      },
    });
    extraTechs.push(t);
    console.log("  technician:", t.username, t.user_id);
  }

  const [tech001, tech002, tech003, tech004, tech005] = extraTechs;

  // 5. Devices — upsert so re-runs always sync status + assignment
  const now = new Date();
  const deviceDefs = [
    {
      device_id: "DEV-001", serial_no: "SN-DEV-001", model: "BioAnalyzer X1",
      status: "ACTIVE", firmware_version: "v2.1.0",
      assigned_to_user_id: tech.user_id, assigned_by_user_id: admin.user_id, assigned_at: now,
    },
    {
      device_id: "DEV-002", serial_no: "SN-DEV-002", model: "BioAnalyzer X1",
      status: "ACTIVE", firmware_version: "v2.1.0",
      assigned_to_user_id: tech001.user_id, assigned_by_user_id: admin.user_id, assigned_at: now,
    },
    {
      device_id: "DEV-003", serial_no: "SN-DEV-003", model: "BioAnalyzer X1",
      status: "ACTIVE", firmware_version: "v2.1.0",
      assigned_to_user_id: tech003.user_id, assigned_by_user_id: admin.user_id, assigned_at: now,
    },
    {
      device_id: "DEV-004", serial_no: "SN-DEV-004", model: "BioAnalyzer X1",
      status: "ACTIVE", firmware_version: "v2.1.0",
      assigned_to_user_id: tech002.user_id, assigned_by_user_id: admin.user_id, assigned_at: now,
    },
    {
      device_id: "DEV-005", serial_no: "SN-DEV-005", model: "BioAnalyzer X1",
      status: "ACTIVE", firmware_version: "v2.1.0",
      assigned_to_user_id: tech004.user_id, assigned_by_user_id: admin.user_id, assigned_at: now,
    },
    {
      device_id: "DEV-006", serial_no: "SN-DEV-006", model: "BioAnalyzer X1",
      status: "ACTIVE", firmware_version: "v2.1.0",
      assigned_to_user_id: tech005.user_id, assigned_by_user_id: admin.user_id, assigned_at: now,
    },
  ];

  let device;
  for (const def of deviceDefs) {
    await Devices.upsert({ ...def, org_id: org.org_id, department_id: dept.department_id });
    if (def.device_id === "DEV-001") device = await Devices.findByPk("DEV-001");
    console.log("  device:", def.device_id, def.model, def.status);
  }

  // 6. Test types
  const testTypeDefs = [
    // ── Legacy seed types (kept for compatibility) ────────────────────────────
    {
      name: "Haemoglobin",
      unit: "g/dL",
      method: "Colorimetric",
      normal_min: 11.5, normal_max: 17.5,
      male_min: 13.5, male_max: 17.5,
      female_min: 11.5, female_max: 15.5,
      threshold_operator: "<", threshold_value: 8.0,
    },
    {
      name: "Blood Glucose (Fasting)",
      unit: "mg/dL",
      method: "Enzymatic",
      normal_min: 70, normal_max: 100,
      male_min: 70, male_max: 100,
      female_min: 70, female_max: 100,
      threshold_operator: ">", threshold_value: 200,
    },
    {
      name: "Total Cholesterol",
      unit: "mg/dL",
      method: "Colorimetric",
      normal_min: 0, normal_max: 200,
      male_min: 0, male_max: 200,
      female_min: 0, female_max: 200,
      threshold_operator: ">", threshold_value: 240,
    },
    // ── Device-supported test types ───────────────────────────────────────────
    {
      name: "Albumin",
      unit: "g/dL",
      normal_min: 3.5, normal_max: 5.0,
      male_min: 3.5, male_max: 5.0,
      female_min: 3.5, female_max: 5.0,
    },
    {
      name: "Cal",
      unit: "mg/dL",
      normal_min: 8.5, normal_max: 10.5,
      male_min: 8.5, male_max: 10.5,
      female_min: 8.5, female_max: 10.5,
    },
    {
      name: "Chol",
      unit: "mg/dL",
      normal_min: 0, normal_max: 200,
      male_min: 0, male_max: 200,
      female_min: 0, female_max: 200,
      threshold_operator: ">", threshold_value: 240,
    },
    {
      name: "Cr",
      unit: "mg/dL",
      male_min: 0.7, male_max: 1.3,
      female_min: 0.5, female_max: 1.0,
    },
    {
      name: "Glu",
      unit: "g/dL",
      normal_min: 0.7, normal_max: 1.0,
      male_min: 0.7, male_max: 1.0,
      female_min: 0.7, female_max: 1.0,
      threshold_operator: ">", threshold_value: 2.0,
    },
    {
      name: "HB",
      unit: "g/dL",
      normal_min: 11.5, normal_max: 17.5,
      male_min: 13.5, male_max: 17.5,
      female_min: 11.5, female_max: 15.5,
      threshold_operator: "<", threshold_value: 8.0,
    },
    {
      name: "HIV",
      unit: "",
      // qualitative — no numeric range; flag any positive via threshold
    },
    {
      name: "Hb",
      unit: "g/dL",
      normal_min: 11.5, normal_max: 17.5,
      male_min: 13.5, male_max: 17.5,
      female_min: 11.5, female_max: 15.5,
      threshold_operator: "<", threshold_value: 8.0,
    },
    {
      name: "SCr",
      unit: "mg/dL",
      male_min: 0.7, male_max: 1.3,
      female_min: 0.5, female_max: 1.0,
    },
    {
      name: "Triglyceride",
      unit: "mg/dL",
      normal_min: 0, normal_max: 150,
      male_min: 0, male_max: 150,
      female_min: 0, female_max: 150,
      threshold_operator: ">", threshold_value: 200,
    },
  ];

  const testTypeIds = [];
  for (const def of testTypeDefs) {
    const [tt] = await TestTypes.findOrCreate({
      where: { org_id: org.org_id, name: def.name },
      defaults: { test_type_id: uuidv4(), org_id: org.org_id, ...def },
    });
    testTypeIds.push(tt.test_type_id);
    console.log("  test_type:", tt.name, tt.test_type_id);
  }

  // 7. Patients
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
      created_by: tech.user_id,
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
      created_by: tech.user_id,
    },
  });
  console.log("  patients:", p1.patient_id, p2.patient_id);

  // 8. Test sessions (TestHistory) + results for sample patients
  const sessionNow = new Date();
  const yesterday = new Date(sessionNow - 86400000);

  const sessions = [
    {
      patient: p1, date: sessionNow, notes: "Routine checkup",
      results: [
        { test_type_id: testTypeIds[0], value_num: 12.4 },
        { test_type_id: testTypeIds[1], value_num: 95 },
      ],
    },
    {
      patient: p1, date: yesterday, notes: "Follow-up",
      results: [
        { test_type_id: testTypeIds[2], value_num: 215 },
      ],
    },
    {
      patient: p2, date: sessionNow, notes: "Initial visit",
      results: [
        { test_type_id: testTypeIds[0], value_num: 10.1 },
        { test_type_id: testTypeIds[1], value_num: 88 },
      ],
    },
  ];

  for (const session of sessions) {
    const history = await TestHistory.create({
      history_id: uuidv4(),
      patient_id: session.patient.patient_id,
      org_id: org.org_id,
      department_id: dept.department_id,
      device_id: device.device_id,
      entered_by_user_id: tech.user_id,
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
  console.log("  test sessions + results: seeded");

  console.log("\n✅ Seed complete.\n");
  console.log("════════════════════════════════════════");
  console.log("  SUB ADMIN (ADMIN role)");
  console.log("  username : admin_demo   password : Admin@123");
  console.log("════════════════════════════════════════");
  console.log("  TECHNICIANS (all same org + dept as Sub Admin)");
  console.log("  username : tech_demo    password : Tech@123   name: Riya Sharma");
  console.log("  username : tech_001     password : Tech@123   name: Arjun Patel");
  console.log("  username : tech_002     password : Tech@123   name: Sneha Kulkarni");
  console.log("  username : tech_003     password : Tech@123   name: Karan Verma");
  console.log("  username : tech_004     password : Tech@123   name: Divya Menon");
  console.log("  username : tech_005     password : Tech@123   name: Priya Das");
  console.log("════════════════════════════════════════");
  console.log("  DEVICES (all ACTIVE, each assigned to one technician)");
  console.log("  DEV-001  BioAnalyzer X1      ACTIVE  → tech_demo");
  console.log("  DEV-002  BioAnalyzer X1      ACTIVE  → tech_001");
  console.log("  DEV-003  HemaCount Pro        ACTIVE  → tech_003");
  console.log("  DEV-004  GlucoScan 3000       ACTIVE  → tech_002");
  console.log("  DEV-005  CholestCheck Ultra   ACTIVE  → tech_004");
  console.log("  DEV-006  UrineAnalyzer Z2     ACTIVE  → tech_005");
  console.log("════════════════════════════════════════\n");

  await sequelize.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
