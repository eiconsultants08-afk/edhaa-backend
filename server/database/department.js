import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

const Department = sequelize.define(
  "department",
  {
    department_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    department_name: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Department;