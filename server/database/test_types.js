import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

const TestTypes = sequelize.define(
  "test_types",
  {
    test_type_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    full_name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    unit: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    method: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    normal_min: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    normal_max: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    male_min: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    male_max: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    female_min: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    female_max: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },

    category: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    method_options: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    reference_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    critical_low: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    critical_high: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    is_qualitative: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    specimen_type: {
      type: DataTypes.TEXT,   // "Blood" | "Urine" | "Saliva"
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default TestTypes;
