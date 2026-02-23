import { DataTypes } from "sequelize";
import sequelize from "./connectdb.js";
import Users from "./users.js";
import Organization from "./organization.js";

const Tokens = sequelize.define(
  "tokens",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    token: { type: DataTypes.TEXT, allowNull: false },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Users, key: "user_id" },
      onDelete: "CASCADE",
    },

    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Organization, key: "org_id" },
      onDelete: "CASCADE",
    },

    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { unique: true, fields: ["user_id", "org_id"] }, // matches tokens_user_org_uniq
      { fields: ["expires_at"] },
    ],
  }
);

// Associations
Tokens.belongsTo(Users, { foreignKey: "user_id" });
Tokens.belongsTo(Organization, { foreignKey: "org_id" });

export default Tokens;