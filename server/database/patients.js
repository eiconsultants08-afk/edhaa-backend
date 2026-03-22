import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";
import Organization from "./organization.js";
import Users from "./users.js";

const Patients = sequelize.define(
  "patients",
  {
    patient_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    patient_code: {
      type: DataTypes.INTEGER,
    },

    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Organization, key: "org_id" },
      onDelete: "RESTRICT",
    },

    name: { type: DataTypes.TEXT, allowNull: false },

    gender: {
      type: DataTypes.ENUM("MALE", "FEMALE", "OTHER"),
      allowNull: true,
    },

    dob: { type: DataTypes.DATEONLY },
    address: { type: DataTypes.TEXT },
    phone: { type: DataTypes.TEXT },
    email: { type: DataTypes.TEXT },

    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Users, key: "user_id" },
      onDelete: "RESTRICT",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      // patient_id is the primary key — already indexed and unique in PostgreSQL.
      // This explicit definition makes it discoverable via sync and skips creation if it exists.
      { unique: true, fields: ["patient_id"], name: "patients_patient_id_unique" },
    ],
  }
);

// Associations
Patients.belongsTo(Organization, { foreignKey: "org_id", as: "org" });
Patients.belongsTo(Users, { foreignKey: "created_by", as: "creator" });

export default Patients;