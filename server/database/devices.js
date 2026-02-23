import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";
import Organization from "./organization.js";
import Users from "./users.js";
import Department from "./department.js";

const Devices = sequelize.define(
  "devices",
  {
    device_id: {
      type: DataTypes.TEXT, // <-- you changed it to TEXT
      primaryKey: true,
    },

    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Organization, key: "org_id" },
      onDelete: "RESTRICT",
    },

    serial_no: { type: DataTypes.TEXT, allowNull: false, unique: true },
    model: { type: DataTypes.TEXT, allowNull: false },

    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE", "MAINTENANCE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    firmware_version: { type: DataTypes.TEXT },
    last_used_at: { type: DataTypes.DATE },

    assigned_to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Users, key: "user_id" },
      onDelete: "SET NULL",
    },

    assigned_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Users, key: "user_id" },
      onDelete: "SET NULL",
    },

    assigned_at: { type: DataTypes.DATE },

    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Department, key: "department_id" },
      onDelete: "SET NULL",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Associations
Devices.belongsTo(Organization, { foreignKey: "org_id" });
Devices.belongsTo(Users, { foreignKey: "assigned_to_user_id", as: "assignedTo" });
Devices.belongsTo(Users, { foreignKey: "assigned_by_user_id", as: "assignedBy" });
Devices.belongsTo(Department, { foreignKey: "department_id" });

export default Devices;