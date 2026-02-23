import Users from "./users.js";
import Tokens from "./tokens.js";
import Devices from "./devices.js";

import { Op, fn, col } from "sequelize";
import sequelize from "./connectdb.js";
import { constants } from "../constants.js";
import { checkToken } from "../utils.js";
import Organization from "./organization.js";
import Department from "./department.js";

export async function getUserByCondition(condition) {
  return Users.findOne({
    where: condition,
    raw: true,
  });
}

export async function createTechnician(data) {
  return Users.create(data);
}

export async function updateToken(user_id, org_id, refreshToken) {

  // Verify + decode refresh token
  const decoded = checkToken(refreshToken, constants.REFRESH_TOKEN_SECRET);

  // exp is in seconds → convert to milliseconds
  const expiresAt = new Date(decoded.exp * 1000);

  let cToken = await Tokens.findOne({ where: { user_id, org_id } });

  if (cToken === null) {
    await Tokens.create({
      token: refreshToken,
      user_id,
      org_id,
      expires_at: expiresAt,
    });
  } else {
    cToken.set({
      token: refreshToken,
      expires_at: expiresAt,
    });
    await cToken.save();
  }
}
export async function verifyToken(user_id, org_id, token) {
  let cToken = await Tokens.findOne({ where: { user_id: user_id, org_id: org_id } });
  if (cToken === null) {
    return false;
  }
  if (cToken.token !== token) {
    await cToken.destroy();
    return false;
  }
  return true;
}

export async function removeToken(user_id, org_id) {
  let cToken = await Tokens.findOne({ where: { user_id: user_id, org_id: org_id } });
  if (cToken !== null) {
    await cToken.destroy();
  }
}



// ADMIN APIS 

//get all devices
export async function getDevices(limit, offset, conditions) {
  const options = {
    where: conditions,
    limit,
    order: [["created_at", "DESC"]],
    raw: true,          // ✅ flat output
    subQuery: false,    // ✅ helps with limit + include
    distinct: true,     // ✅ correct count
    include: [
      { model: Organization, as: "org", attributes: [], required: false },
      { model: Department, as: "department", attributes: [], required: false },
      { model: Users, as: "assignedTo", attributes: [], required: false },
      { model: Users, as: "assignedBy", attributes: [], required: false },
    ],
    attributes: {
      include: [
        // Org
        [sequelize.col("org.org_id"), "org_id"],
        [sequelize.col("org.org_name"), "org_name"],
        [sequelize.col("org.code"), "org_code"],
        [sequelize.col("org.status"), "org_status"],

        // Department
        [sequelize.col("department.department_id"), "department_id"],
        [sequelize.col("department.department_name"), "department_name"],

        // Assigned To (Technician)
        [sequelize.col("assignedTo.user_id"), "assigned_to_user_id"],
        [sequelize.col("assignedTo.name"), "assigned_to_name"],
        [sequelize.col("assignedTo.email"), "assigned_to_email"],
        [sequelize.col("assignedTo.username"), "assigned_to_username"],
        [sequelize.col("assignedTo.role"), "assigned_to_role"],

        // Assigned By (Admin)
        [sequelize.col("assignedBy.user_id"), "assigned_by_user_id"],
        [sequelize.col("assignedBy.name"), "assigned_by_name"],
        [sequelize.col("assignedBy.email"), "assigned_by_email"],
        [sequelize.col("assignedBy.username"), "assigned_by_username"],
        [sequelize.col("assignedBy.role"), "assigned_by_role"],
      ],
    },
  };

  if (offset > 0) options.offset = offset;

  return Devices.findAndCountAll(options);
}


//get device by id 
export async function getDeviceByIdFlat(device_id) {
  return Devices.findOne({
    where: { device_id },
    raw: true,
    subQuery: false,

    include: [
      { model: Organization, as: "org", attributes: [], required: false },
      { model: Department, as: "department", attributes: [], required: false },
      { model: Users, as: "assignedTo", attributes: [], required: false },
      { model: Users, as: "assignedBy", attributes: [], required: false },
    ],

    attributes: {
      include: [
        // ✅ Organization (flat)
        [sequelize.col("org.org_name"), "org_name"],
        [sequelize.col("org.code"), "org_code"],
        [sequelize.col("org.status"), "org_status"],

        // ✅ Department (flat)
        [sequelize.col("department.department_name"), "department_name"],

        // ✅ Assigned To (flat)
        [sequelize.col("assignedTo.name"), "assigned_to_name"],
        [sequelize.col("assignedTo.email"), "assigned_to_email"],
        [sequelize.col("assignedTo.username"), "assigned_to_username"],
        [sequelize.col("assignedTo.role"), "assigned_to_role"],
        [sequelize.col("assignedTo.status"), "assigned_to_status"],

        // ✅ Assigned By (flat)
        [sequelize.col("assignedBy.name"), "assigned_by_name"],
        [sequelize.col("assignedBy.email"), "assigned_by_email"],
        [sequelize.col("assignedBy.username"), "assigned_by_username"],
        [sequelize.col("assignedBy.role"), "assigned_by_role"],
        [sequelize.col("assignedBy.status"), "assigned_by_status"],
      ],
    },
  });
}

export async function getUsers(limit, offset, conditions) {
  let options = {
    where: conditions,
    limit,
    order: [["created_at", "DESC"]],
    raw: true,
    subQuery: false,
    distinct: true,

    attributes: {
      include: [
        ...constants.USER_ATTRIBUTES.map(attr => attr),

        // ✅ Organization (alias: org)
        [sequelize.col("org.org_name"), "org_name"],
        [sequelize.col("org.code"), "org_code"],
        [sequelize.col("org.status"), "org_status"],

        // ✅ Department
        [sequelize.col("department.department_name"), "department_name"],
      ],
    },

    include: [
      {
        model: Organization,
        as: "org",
        attributes: [],
        required: false,
      },
      {
        model: Department,
        as: "department",
        attributes: [],
        required: false,
      },
    ],
  };

  if (offset > 0) {
    options.offset = offset;
  }

  return Users.findAndCountAll(options);
}