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
  }
);

// Associations
Patients.belongsTo(Organization, { foreignKey: "org_id" });
Patients.belongsTo(Users, { foreignKey: "created_by", as: "creator" });

export default Patients;