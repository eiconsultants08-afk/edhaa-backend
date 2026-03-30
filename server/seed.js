/**
 * Full demo seed — showcases all EDHHA app features.
 *
 * Keeps    : org, department, ADMIN user(s)
 * Replaces : all org-scoped data (technicians, devices, patients, test types,
 *            test histories, results)
 *
 * Creates:
 *   3 technicians  — tech.raj (most active), tech.priya, tech.meena (least active)
 *   3 devices      — DEV-001 & DEV-002 assigned; DEV-003 unassigned
 *   20 patients    — mixed demographics
 *   9 test types   — numeric + text, with realistic abnormal rates
 *   ~300–450 sessions over 90 days
 *     • Last 7 days : 5–7/day, ~20% PENDING (shows pending workflow)
 *     • Days 8–30   : 3–5/day, all COMPLETED
 *     • Days 31–90  : 2–4/day, all COMPLETED
 *
 * Run:  node server/seed.js [admin_username]
 *
 * All accounts password: Demo@1234
 */

import "./secret/secrets.js";
import sequelize from "./database/connectdb.js";
import "./database/associations.js";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

import Users              from "./database/users.js";
import Patients           from "./database/patients.js";
import Devices            from "./database/devices.js";
import TestTypes          from "./database/test_types.js";
import TestHistory        from "./database/test_history.js";
import PatientTestResults from "./database/patient_test_results.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const rnd   = (min, max) => Math.random() * (max - min) + min;
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const round = (n, d = 2) => parseFloat(n.toFixed(d));

/** Returns a Date object set to [daysAgo] days in the past, with a random clinic hour (8am–5pm) */
function pastDate(daysAgo, hourOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(8 + hourOffset + Math.floor(rnd(0, 1)), Math.floor(rnd(0, 60)), 0, 0);
  return d;
}

/** Weighted random pick — weights[] must sum to 1 */
function weightedPick(arr, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i];
    if (r < acc) return arr[i];
  }
  return arr[arr.length - 1];
}

/** Fetch next value from a PostgreSQL sequence */
async function nextval(seqName) {
  const rows = await sequelize.query(
    `SELECT nextval('${seqName}')::int AS val`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return rows[0].val;
}

// ── Patient pool (20 patients) ────────────────────────────────────────────────

const PATIENT_POOL = [
  { name: "Arjun Sharma",      gender: "MALE",   dob: "1980-04-12", phone: "9810011001", email: "arjun.sharma@mail.com"      },
  { name: "Preethi Nair",      gender: "FEMALE", dob: "1993-07-25", phone: "9810011002", email: "preethi.nair@mail.com"      },
  { name: "Mohammed Rafi",     gender: "MALE",   dob: "1975-11-03", phone: "9810011003", email: "mohammed.rafi@mail.com"     },
  { name: "Sunita Devi",       gender: "FEMALE", dob: "1988-02-18", phone: "9810011004", email: "sunita.devi@mail.com"       },
  { name: "Vikram Patel",      gender: "MALE",   dob: "1965-09-30", phone: "9810011005", email: "vikram.patel@mail.com"      },
  { name: "Lakshmi Rao",       gender: "FEMALE", dob: "1971-06-14", phone: "9810011006", email: "lakshmi.rao@mail.com"       },
  { name: "Deepak Verma",      gender: "MALE",   dob: "1995-01-22", phone: "9810011007", email: "deepak.verma@mail.com"      },
  { name: "Anjali Gupta",      gender: "FEMALE", dob: "1990-08-09", phone: "9810011008", email: "anjali.gupta@mail.com"      },
  { name: "Suresh Kumar",      gender: "MALE",   dob: "1958-12-05", phone: "9810011009", email: "suresh.kumar@mail.com"      },
  { name: "Rekha Menon",       gender: "FEMALE", dob: "1983-03-27", phone: "9810011010", email: "rekha.menon@mail.com"       },
  { name: "Rajesh Bose",       gender: "MALE",   dob: "1970-10-16", phone: "9810011011", email: "rajesh.bose@mail.com"       },
  { name: "Kavitha Pillai",    gender: "FEMALE", dob: "1997-05-01", phone: "9810011012", email: "kavitha.pillai@mail.com"    },
  { name: "Anil Khanna",       gender: "MALE",   dob: "1962-07-19", phone: "9810011013", email: "anil.khanna@mail.com"       },
  { name: "Divya Reddy",       gender: "FEMALE", dob: "1986-11-11", phone: "9810011014", email: "divya.reddy@mail.com"       },
  { name: "Sanjay Mishra",     gender: "MALE",   dob: "1978-04-07", phone: "9810011015", email: "sanjay.mishra@mail.com"     },
  { name: "Meera Krishnan",    gender: "FEMALE", dob: "1969-08-22", phone: "9810011016", email: "meera.krishnan@mail.com"    },
  { name: "Rahul Tiwari",      gender: "MALE",   dob: "1991-03-15", phone: "9810011017", email: "rahul.tiwari@mail.com"      },
  { name: "Pooja Bhatt",       gender: "FEMALE", dob: "1984-12-30", phone: "9810011018", email: "pooja.bhatt@mail.com"       },
  { name: "Karthik Subramaniam", gender: "MALE", dob: "1973-06-08", phone: "9810011019", email: "karthik.sub@mail.com"       },
  { name: "Nandita Singh",     gender: "FEMALE", dob: "1999-01-19", phone: "9810011020", email: "nandita.singh@mail.com"     },
];

// ── Test type definitions (9 types) ──────────────────────────────────────────

const TEST_TYPE_DEFS = [
  {
    name: "Blood Glucose", unit: "mg/dL",
    normal_min: 70,   normal_max: 100,
    male_min:   70,   male_max:   100,
    female_min: 70,   female_max: 100,
    // 40% high (diabetic/pre-diabetic range)
    genValue: () => Math.random() < 0.40
      ? round(rnd(106, 240))
      : round(rnd(72, 99)),
  },
  {
    name: "Hemoglobin", unit: "g/dL",
    normal_min: 12,   normal_max: 17.5,
    male_min:   13.5, male_max:   17.5,
    female_min: 12,   female_max: 15.5,
    // 28% low (anaemia pattern)
    genValue: (gender) => {
      const lo = gender === "FEMALE" ? 12   : 13.5;
      const hi = gender === "FEMALE" ? 15.5 : 17.5;
      return Math.random() < 0.28
        ? round(rnd(7.5, lo - 0.5))
        : round(rnd(lo + 0.2, hi));
    },
  },
  {
    name: "Total Cholesterol", unit: "mg/dL",
    normal_min: 0,    normal_max: 200,
    male_min:   0,    male_max:   200,
    female_min: 0,    female_max: 200,
    // 32% high
    genValue: () => Math.random() < 0.32
      ? round(rnd(205, 295))
      : round(rnd(140, 198)),
  },
  {
    name: "Systolic BP", unit: "mmHg",
    normal_min: 90,   normal_max: 120,
    male_min:   90,   male_max:   120,
    female_min: 90,   female_max: 120,
    // 30% high
    genValue: () => Math.random() < 0.30
      ? round(rnd(125, 172), 0)
      : round(rnd(92, 119), 0),
  },
  {
    name: "Creatinine", unit: "mg/dL",
    normal_min: 0.6,  normal_max: 1.2,
    male_min:   0.6,  male_max:   1.2,
    female_min: 0.5,  female_max: 1.1,
    // 20% high (kidney strain)
    genValue: () => Math.random() < 0.20
      ? round(rnd(1.3, 2.8))
      : round(rnd(0.65, 1.18)),
  },
  {
    name: "WBC Count", unit: "K/µL",
    normal_min: 4.5,  normal_max: 11.0,
    male_min:   4.5,  male_max:   11.0,
    female_min: 4.5,  female_max: 11.0,
    // 15% high (infection), 7% low (immune suppression)
    genValue: () => {
      const r = Math.random();
      if (r < 0.15) return round(rnd(11.5, 19), 1);
      if (r < 0.22) return round(rnd(2.0,  4.2), 1);
      return round(rnd(4.7, 10.6), 1);
    },
  },
  {
    name: "Uric Acid", unit: "mg/dL",
    normal_min: 2.5,  normal_max: 7.0,
    male_min:   3.5,  male_max:   7.0,
    female_min: 2.5,  female_max: 6.0,
    // 24% high (gout / diet-related)
    genValue: (gender) => {
      const max = gender === "FEMALE" ? 6.0 : 7.0;
      return Math.random() < 0.24
        ? round(rnd(max + 0.3, max + 3.5))
        : round(rnd(2.8, max - 0.2));
    },
  },
  {
    name: "Platelet Count", unit: "K/µL",
    normal_min: 150,  normal_max: 400,
    male_min:   150,  male_max:   400,
    female_min: 150,  female_max: 400,
    // 10% low (thrombocytopenia), 8% high (reactive)
    genValue: () => {
      const r = Math.random();
      if (r < 0.10) return round(rnd(40, 148), 0);
      if (r < 0.18) return round(rnd(405, 650), 0);
      return round(rnd(155, 395), 0);
    },
  },
  {
    name: "HIV Screen", unit: "-",
    normal_min: null, normal_max: null,
    male_min:   null, male_max:   null,
    female_min: null, female_max: null,
    isText: true,
    // 7% positive
    genValue: () => Math.random() < 0.07 ? "POSITIVE" : "NEGATIVE",
  },
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

async function seed() {
  await sequelize.authenticate();
  console.log("✅ DB connected\n");

  // ── 0. Ensure sequences and columns exist ──────────────────────────────────
  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS patients_patient_code_seq;`);
  await sequelize.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_code INTEGER;`);
  await sequelize.query(`ALTER TABLE patients ALTER COLUMN patient_code SET DEFAULT nextval('patients_patient_code_seq');`);

  await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS organizations_org_code_seq;`);
  await sequelize.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code INTEGER;`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN org_code SET DEFAULT nextval('organizations_org_code_seq');`);
  console.log("✅ Sequences verified\n");

  // ── 1. Find the one admin, delete any duplicates ──────────────────────────
  const allAdmins = await Users.findAll({ where: { role: "ADMIN" }, raw: true });
  if (!allAdmins.length) throw new Error("No ADMIN user found. Create one via the app first.");

  const admin = allAdmins[0];
  const extraAdmins = allAdmins.slice(1);

  if (extraAdmins.length) {
    console.log(`🗑  Removing ${extraAdmins.length} duplicate admin(s) …`);
    for (const dup of extraAdmins) {
      await sequelize.query(`DELETE FROM tokens WHERE user_id = :uid`, { replacements: { uid: dup.user_id } });
      await sequelize.query(`DELETE FROM users  WHERE user_id = :uid`, { replacements: { uid: dup.user_id } });
    }
    console.log("   Done.\n");
  }

  // Reset admin password to Demo@1234 so credentials are always known after seed
  const adminHash = await bcrypt.hash("Demo@1234", 10);
  await sequelize.query(
    `UPDATE users SET password = :pw WHERE user_id = :uid`,
    { replacements: { pw: adminHash, uid: admin.user_id } }
  );

  const { org_id, department_id } = admin;
  console.log(`📌 Admin: ${admin.username || admin.email}  /  Demo@1234`);
  console.log(`   Org:   ${org_id}\n`);

  // Backfill org_code if missing
  await sequelize.query(
    `UPDATE organizations SET org_code = nextval('organizations_org_code_seq') WHERE org_id = :oid AND org_code IS NULL`,
    { replacements: { oid: org_id } }
  );

  // ── 2. Wipe existing org data ──────────────────────────────────────────────

  console.log("🗑  Wiping existing org data …");
  await sequelize.query(`DELETE FROM patient_test_results WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_histories      WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM test_types          WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM patients            WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM devices             WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM tokens              WHERE org_id = :oid`, { replacements: { oid: org_id } });
  await sequelize.query(`DELETE FROM users WHERE org_id = :oid AND role = 'TECHNICIAN'`, { replacements: { oid: org_id } });

  // Purge any globally-orphaned demo technician accounts from prior runs
  const demoTechs = ["tech.raj", "tech.priya", "tech.meena"];
  await sequelize.query(`
    DELETE FROM patient_test_results
    WHERE history_id IN (
      SELECT history_id FROM test_histories
      WHERE entered_by_user_id IN (SELECT user_id FROM users WHERE username IN (:names))
    )
  `, { replacements: { names: demoTechs } });
  await sequelize.query(`
    DELETE FROM patient_test_results
    WHERE patient_id IN (
      SELECT patient_id FROM patients
      WHERE created_by IN (SELECT user_id FROM users WHERE username IN (:names))
    )
  `, { replacements: { names: demoTechs } });
  await sequelize.query(`
    DELETE FROM test_histories
    WHERE entered_by_user_id IN (SELECT user_id FROM users WHERE username IN (:names))
  `, { replacements: { names: demoTechs } });
  await sequelize.query(`
    DELETE FROM patients
    WHERE created_by IN (SELECT user_id FROM users WHERE username IN (:names))
  `, { replacements: { names: demoTechs } });
  await sequelize.query(`
    UPDATE devices SET assigned_to_user_id = NULL, assigned_by_user_id = NULL
    WHERE assigned_to_user_id IN (SELECT user_id FROM users WHERE username IN (:names))
  `, { replacements: { names: demoTechs } });
  await sequelize.query(`DELETE FROM tokens WHERE user_id IN (SELECT user_id FROM users WHERE username IN (:names))`, { replacements: { names: demoTechs } });
  await sequelize.query(`DELETE FROM users WHERE username IN (:names)`, { replacements: { names: demoTechs } });
  console.log("   Done.\n");

  // ── 3. Create technicians ─────────────────────────────────────────────────

  console.log("👤 Creating 3 technicians …");
  const hash = await bcrypt.hash("Demo@1234", 10);

  const tech1 = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Raj Kulkarni", email: "raj.kulkarni@demo.com",
    username: "tech.raj", phone: "9900000101",
    password: hash, org_id, department_id, status: "WORKING",
  });
  const tech2 = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Priya Desai", email: "priya.desai@demo.com",
    username: "tech.priya", phone: "9900000102",
    password: hash, org_id, department_id, status: "WORKING",
  });
  const tech3 = await Users.create({
    user_id: randomUUID(), role: "TECHNICIAN",
    name: "Meena Iyer", email: "meena.iyer@demo.com",
    username: "tech.meena", phone: "9900000103",
    password: hash, org_id, department_id, status: "ACTIVE",
  });

  console.log(`   tech.raj   / Demo@1234  (${tech1.name})`);
  console.log(`   tech.priya / Demo@1234  (${tech2.name})`);
  console.log(`   tech.meena / Demo@1234  (${tech3.name})\n`);

  // ── 4. Create devices ─────────────────────────────────────────────────────

  console.log("🖥  Creating 3 devices (DEV-001 & DEV-002 assigned, DEV-003 unassigned) …");

  const device1 = await Devices.create({
    device_id: "DEV-DEMO-001", org_id,
    serial_no: "SN-DEMO-001", model: "BioAnalyzer Pro X1",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: tech1.user_id,
    assigned_by_user_id: admin.user_id,
    assigned_at: new Date(),
  });
  const device2 = await Devices.create({
    device_id: "DEV-DEMO-002", org_id,
    serial_no: "SN-DEMO-002", model: "BioAnalyzer Pro X2",
    status: "ACTIVE", firmware_version: "v2.4.1", department_id,
    assigned_to_user_id: tech2.user_id,
    assigned_by_user_id: admin.user_id,
    assigned_at: new Date(),
  });
  const device3 = await Devices.create({
    device_id: "DEV-DEMO-003", org_id,
    serial_no: "SN-DEMO-003", model: "HemaScan Ultra 500",
    status: "ACTIVE", firmware_version: "v1.9.0", department_id,
    assigned_to_user_id: null,
    assigned_by_user_id: null,
    assigned_at: null,
  });

  console.log(`   ${device1.device_id} → ${tech1.name}`);
  console.log(`   ${device2.device_id} → ${tech2.name}`);
  console.log(`   ${device3.device_id} → (unassigned)\n`);

  const devices = [device1, device2, device3];
  const assignedDevices = [device1, device2];

  // ── 5. Create patients ────────────────────────────────────────────────────

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

  // ── 6. Create test types ──────────────────────────────────────────────────

  console.log("🔬 Creating 9 test types …");

  const createdTypes = await TestTypes.bulkCreate(
    TEST_TYPE_DEFS.map(t => ({
      test_type_id: randomUUID(),
      org_id,
      name:         t.name,
      unit:         t.unit,
      method:       null,
      normal_min:   t.normal_min,
      normal_max:   t.normal_max,
      male_min:     t.male_min,
      male_max:     t.male_max,
      female_min:   t.female_min,
      female_max:   t.female_max,
      is_active:    true,
    })),
    { returning: true }
  );

  const testTypes    = createdTypes.map(r => r.get({ plain: true }));
  const numericTypes = testTypes.filter(t => t.normal_min !== null);
  const hivType      = testTypes.find(t => t.name === "HIV Screen");
  const bgType       = testTypes.find(t => t.name === "Blood Glucose");
  const defMap       = TEST_TYPE_DEFS.reduce((m, d) => { m[d.name] = d; return m; }, {});
  console.log(`   ${testTypes.length} test types\n`);

  // ── 7. Generate sessions + results ────────────────────────────────────────
  //
  // Technician activity weights (drives the technician activity bar chart):
  //   tech.raj   50%  — highest activity (most assigned sessions)
  //   tech.priya 35%  — mid activity
  //   tech.meena 15%  — lowest (recently inactive, status ACTIVE not WORKING)
  //
  // Session count per day:
  //   Days  0–6  : 5–7/day  (recent spike visible on daily line chart)
  //   Days  7–29 : 3–5/day
  //   Days 30–89 : 2–4/day
  //
  // PENDING: 20% of sessions in the last 7 days stay PENDING

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
      const patient  = pick(patients);
      const tech     = weightedPick(techPool, techWeights);
      // Prefer the device assigned to this tech; fall back to any assigned device
      const device   = tech.user_id === tech1.user_id ? device1
                     : tech.user_id === tech2.user_id ? device2
                     : pick(assignedDevices);
      const hourSlot = s % 8; // spread sessions across the day
      const testDate = pastDate(daysAgo, hourSlot);

      const isPending = isRecent && Math.random() < 0.20;
      const status    = isPending ? "PENDING" : "COMPLETED";
      const notes     = isPending ? null : (Math.random() < 0.55 ? pick(NOTES_POOL) : null);

      const history = await TestHistory.create({
        history_id:         randomUUID(),
        patient_id:         patient.patient_id,
        org_id,
        department_id,
        device_id:          device.device_id,
        entered_by_user_id: tech.user_id,
        test_date:          testDate,
        status,
        notes,
      });

      // Build session test panel:
      //   Blood Glucose always included
      //   1–3 random additional numeric tests
      //   HIV Screen included 25% of the time
      const extras = [...numericTypes]
        .filter(t => t.name !== "Blood Glucose")
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(rnd(1, 4)));

      const sessionTypes = [bgType, ...extras];
      if (Math.random() < 0.25 && hivType) sessionTypes.push(hivType);

      const rows = sessionTypes.map(tt => {
        const def = defMap[tt.name];
        return {
          result_id:    randomUUID(),
          history_id:   history.history_id,
          patient_id:   patient.patient_id,
          org_id,
          test_type_id: tt.test_type_id,
          value_num:    (!isPending && !def.isText) ? def.genValue(patient.gender) : null,
          value_text:   (!isPending &&  def.isText) ? def.genValue()               : null,
        };
      });

      await PatientTestResults.bulkCreate(rows);
      sessionCount++;
      resultCount  += rows.length;
      if (isPending) pendingCount++;
    }
  }

  console.log(`   ${sessionCount} sessions  (${pendingCount} PENDING, ${sessionCount - pendingCount} COMPLETED)`);
  console.log(`   ${resultCount} results\n`);

  // ── Done ──────────────────────────────────────────────────────────────────

  console.log("🎉 Seed complete!\n");
  console.log("─────────────────────────────────────────────────────────");
  console.log("  Log in with your existing ADMIN account to see analytics.");
  console.log("");
  console.log("  Technician accounts (password: Demo@1234):");
  console.log("    tech.raj    — Raj Kulkarni  (most active, device DEV-001)");
  console.log("    tech.priya  — Priya Desai   (mid activity, device DEV-002)");
  console.log("    tech.meena  — Meena Iyer    (least active, no device assigned)");
  console.log("");
  console.log("  Devices:");
  console.log("    DEV-DEMO-001  → assigned to tech.raj");
  console.log("    DEV-DEMO-002  → assigned to tech.priya");
  console.log("    DEV-DEMO-003  → unassigned (visible in admin device list)");
  console.log("─────────────────────────────────────────────────────────\n");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message || err);
  process.exit(1);
});
