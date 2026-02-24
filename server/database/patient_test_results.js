import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

const PatientTestResults = sequelize.define(
  "patient_test_results",
  {
    result_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    patient_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    test_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
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

    value_num: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    value_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    notes: {
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