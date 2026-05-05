import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

const PlanTestTypes = sequelize.define(
  "plan_test_types",
  {
    plan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    test_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    timestamps: false,
    tableName: "plan_test_types",
  }
);

export default PlanTestTypes;
