import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

/**
 * Plans — billing/feature tiers for organizations.
 *
 * tier: "basic" | "premium" | "custom"
 *   basic   — limited test catalogue (e.g. urine only)
 *   premium — full catalogue, all device types
 *   custom  — org-specific catalogue defined in config.allowed_blood_tests
 *
 * name: unique slug, e.g. "basic", "premium", "edhha_custom"
 *   Standard plans have name === tier.
 *   Custom plans use a descriptive slug so multiple custom clients
 *   can coexist with independent configs.
 *
 * config (JSONB) — plan-specific feature definition:
 *   {
 *     allowed_specimen_types : ["Blood", "Urine"],   // which sample types
 *     allowed_blood_tests    : ["Hb", "RBS", ...],   // null / omit = all
 *     all_tests              : true,                  // premium shorthand
 *     allowed_device_models  : ["BIO-CHEQ ...", ...]  // informational
 *   }
 */
const Plans = sequelize.define(
  "plans",
  {
    plan_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    tier: {
      type: DataTypes.TEXT, // "basic" | "premium" | "custom"
      allowNull: false,
    },
    display_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Plans;
