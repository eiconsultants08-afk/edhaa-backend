// server.js (or index.js)

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { config } from "./constants.js";
import register from "./routes.js";
import sequelize from "./database/connectdb.js";

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
app.listen(config.port, "0.0.0.0", async () => {
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
  } catch (err) {
    console.error("❌ DB Connection failed:", err);
  }
}