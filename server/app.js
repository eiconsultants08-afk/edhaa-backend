// server.js (or index.js)

import { createServer } from "http";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { config } from "./constants.js";
import register from "./routes.js";
import sequelize from "./database/connectdb.js";
import { initSocket } from "./socket.js";

const app = express();

/**
 * ✅ CORS: allow your web UI origins + allow requests with NO Origin (React Native, Postman, curl)
 */
app.use(
  cors({
    origin: (origin, cb) => {
      // React Native / Postman often send no Origin header
      if (!origin) return cb(null, true);

      // Allow your UI origins from config
      if (Array.isArray(config.ui) && config.ui.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    credentials: true,
  })
);

// Handle preflight requests
app.options("*", cors());

/**
 * ✅ Body parsing
 */
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

/**
 * ✅ Simple health route (test from phone browser)
 * http://192.168.29.143:3030/health
 */
app.get("/health", (req, res) => res.status(200).send("OK"));

/**
 * ✅ Register routes
 */
register(app);

/**
 * ✅ Start server on 0.0.0.0 so your phone on the same Wi-Fi can access it
 */
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(config.port, "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${config.port}`);
  await startPostgres();
});

/**
 * ✅ DB init
 */
async function startPostgres() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection successful!");

    const [results] = await sequelize.query("SELECT current_database();");
    console.log("📌 Connected to DB:", results?.[0]?.current_database);

    // Drop NOT NULL on email — email is now optional for technicians
    await sequelize.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
    console.log("✅ users.email column patched (nullable)");

    // Migrate patient_id from UUID → TEXT (runs once; idempotent via type check)
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
    await sequelize.query(`ALTER TABLE patients             DROP COLUMN IF EXISTS patient_code;`);
    await sequelize.query(`ALTER TABLE test_histories       DROP COLUMN IF EXISTS patient_code;`);
    await sequelize.query(`ALTER TABLE patient_test_results DROP COLUMN IF EXISTS patient_code;`);
    await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS patients_id_seq START 1;`);
    console.log("✅ patients.patient_id migrated to TEXT 5-digit format");

    // Add org_code — same sequence-backed numeric ID for organizations
    await sequelize.query(`CREATE SEQUENCE IF NOT EXISTS organizations_org_code_seq;`);
    await sequelize.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code INTEGER;`);
    await sequelize.query(`UPDATE organizations SET org_code = nextval('organizations_org_code_seq') WHERE org_code IS NULL;`);
    await sequelize.query(`ALTER TABLE organizations ALTER COLUMN org_code SET DEFAULT nextval('organizations_org_code_seq');`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS organizations_org_code_unique ON organizations(org_code);`);
    console.log("✅ organizations.org_code column patched (5-digit numeric ID)");

    // Add status column to test_histories (Sequelize pluralises the model name)
    await sequelize.query(`DO $$ BEGIN CREATE TYPE enum_test_history_status AS ENUM ('PENDING', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await sequelize.query(`ALTER TABLE test_histories ADD COLUMN IF NOT EXISTS status enum_test_history_status NOT NULL DEFAULT 'PENDING';`);
    await sequelize.query(`UPDATE test_histories SET status = 'COMPLETED' WHERE status = 'PENDING' AND (SELECT COUNT(*) FROM patient_test_results WHERE patient_test_results.history_id = test_histories.history_id AND (patient_test_results.value_num IS NOT NULL OR patient_test_results.value_text IS NOT NULL)) > 0;`);
    console.log("✅ test_histories.status column patched (PENDING/COMPLETED)");

    // BIO-CHEQ extended test_types fields
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS category TEXT;`);
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS method_options JSONB;`);
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS reference_text TEXT;`);
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_low FLOAT;`);
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS critical_high FLOAT;`);
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS is_qualitative BOOLEAN NOT NULL DEFAULT false;`);
    console.log("✅ test_types extended columns patched (BIO-CHEQ metadata)");

    // method_used on individual test results
    await sequelize.query(`ALTER TABLE patient_test_results ADD COLUMN IF NOT EXISTS method_used TEXT;`);
    console.log("✅ patient_test_results.method_used column patched");

    // specimen_type on test types (Blood / Urine / Saliva / Calculated)
    await sequelize.query(`ALTER TABLE test_types ADD COLUMN IF NOT EXISTS specimen_type TEXT;`);
    console.log("✅ test_types.specimen_type column patched");

    // Fix is_qualitative for any existing rows that use Positive/Negative unit
    // (column was added with DEFAULT false, so pre-existing qualitative tests got false)
    await sequelize.query(`UPDATE test_types SET is_qualitative = true WHERE LOWER(unit) LIKE '%positive%' AND is_qualitative = false;`);
    console.log("✅ test_types.is_qualitative backfilled for Positive/Negative tests");

    await sequelize.sync();
    console.log("✅ Models synced!");

    // Sync technician statuses: valid (non-expired) token + device count → WORKING/ACTIVE/INACTIVE
    await sequelize.query(`
      UPDATE users
      SET status = CASE
        WHEN (SELECT COUNT(*) FROM tokens WHERE user_id = users.user_id AND expires_at > NOW()) > 0
             AND (SELECT COUNT(*) FROM devices WHERE assigned_to_user_id = users.user_id) > 0
          THEN 'WORKING'::enum_users_status
        WHEN (SELECT COUNT(*) FROM tokens WHERE user_id = users.user_id AND expires_at > NOW()) > 0
          THEN 'ACTIVE'::enum_users_status
        ELSE 'INACTIVE'::enum_users_status
      END
      WHERE role = 'TECHNICIAN'::enum_users_role AND status != 'REMOVED'::enum_users_status;
    `);
    console.log("✅ Technician statuses synced (WORKING/ACTIVE/INACTIVE)");
  } catch (err) {
    console.error("❌ DB Connection failed:", err);
  }
}