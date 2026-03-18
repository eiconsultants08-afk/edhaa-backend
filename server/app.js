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

    await sequelize.sync();
    console.log("✅ Models synced!");

    // Drop NOT NULL on email — email is now optional for technicians
    await sequelize.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`);
    console.log("✅ users.email column patched (nullable)");

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