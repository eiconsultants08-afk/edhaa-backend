import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

// Individual measurement within a testing session.
// Session-level metadata (date, device, technician, notes) lives on TestHistory.

const PatientTestResults = sequelize.define(
  "patient_test_results",
  {
    result_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // FK → TestHistory (nullable so existing rows without a history survive sync)
    history_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Kept on the result row for direct patient-scoped queries without joining TestHistory
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    patient_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    test_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    value_num: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    value_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    method_used: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default PatientTestResults;
