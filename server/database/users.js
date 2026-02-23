import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";
import Organization from "./organization.js";
import Department from "./department.js";

const Users = sequelize.define(
  "users",
  {
    user_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    role: {
      type: DataTypes.ENUM("SUPER_ADMIN", "ADMIN", "TECHNICIAN"),
      allowNull: false,
    },

    name: { type: DataTypes.TEXT, allowNull: false },

    email: { type: DataTypes.TEXT, allowNull: false, unique: true },
    username: { type: DataTypes.TEXT, allowNull: false, unique: true },
    phone: { type: DataTypes.TEXT, unique: true },

    password: { type: DataTypes.TEXT, allowNull: false },

    org_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Organization, key: "org_id" },
      onDelete: "SET NULL",
    },

    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Department, key: "department_id" },
      onDelete: "SET NULL",
    },

    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"),
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

// Associations
Users.belongsTo(Organization, { foreignKey: "org_id" });
Users.belongsTo(Department, { foreignKey: "department_id" });

export default Users;