import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";

const Organization = sequelize.define(
  "organizations",
  {
    org_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    org_name: { type: DataTypes.TEXT, allowNull: false },
    address: { type: DataTypes.TEXT },
    phone: { type: DataTypes.TEXT },
    email: { type: DataTypes.TEXT },
    code: { type: DataTypes.TEXT, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Organization;