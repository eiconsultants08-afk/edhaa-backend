import Users from "./users.js";
import Tokens from "./tokens.js";
import { Op, fn, col } from "sequelize";
import sequelize from "./connectdb.js";
import { constants } from "../constants.js";
import { checkToken } from "../utils.js";



export async function getUserByUsername(username) {
  return Users.findOne({ where: { username: username } });
}

export async function getUserById(id) {
  return Users.findByPk(id);
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


