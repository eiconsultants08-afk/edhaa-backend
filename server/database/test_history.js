import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

// A TestHistory row represents one testing session/visit for a patient.
// All session-level metadata lives here; individual measurements live in
// PatientTestResults (which references this via history_id).

const TestHistory = sequelize.define(
  "test_history",
  {
    history_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    patient_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    device_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    entered_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    test_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "COMPLETED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default TestHistory;
