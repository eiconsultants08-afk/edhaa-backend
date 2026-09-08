import { getUserWithOrg } from "../../database/db.js";
import Users from "../../database/users.js";
import { Op } from "sequelize";

//show user profile
export async function userProfile(req, res) {
  try {
    const { user_id } = req;
    const user = await getUserWithOrg({ user_id });
    if (user) {

      res.status(200).send({
        status: 200,
        data: user,
        message: `Data of User ${user_id}`,
      });
    } else {
      res.status(404).send({
        status: 404,
        message: "Invalid User",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(400).send({
      status: 400,
      message: "Displaying user profile failed.",
    });
  }
}

// update logged-in user's email and phone
export async function updateUserProfile(req, res) {
  try {
    const { user_id } = req;
    const { email, phone } = req.body;

    if (!user_id) {
      return res.status(401).send({
        status: 401,
        message: "Unauthorized",
      });
    }

    // Only email and phone are handled here.
    // name, role, org_id, username etc. cannot be changed.
    const cleanEmail = email?.trim() || null;
    const cleanPhone = phone?.trim() || null;

    // Email validation
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).send({
          status: 400,
          message: "Please enter a valid email address.",
        });
      }
    }

    // Phone validation
    if (cleanPhone) {
      const phoneRegex = /^[0-9]{10}$/;

      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).send({
          status: 400,
          message: "Phone number must contain exactly 10 digits.",
        });
      }
    }

    // Check duplicate email
    if (cleanEmail) {
      const existingEmail = await Users.findOne({
        where: {
          email: cleanEmail,
          user_id: {
            [Op.ne]: user_id,
          },
        },
      });

      if (existingEmail) {
        return res.status(409).send({
          status: 409,
          message: "Email is already in use.",
        });
      }
    }

    // Check duplicate phone
    if (cleanPhone) {
      const existingPhone = await Users.findOne({
        where: {
          phone: cleanPhone,
          user_id: {
            [Op.ne]: user_id,
          },
        },
      });

      if (existingPhone) {
        return res.status(409).send({
          status: 409,
          message: "Phone number is already in use.",
        });
      }
    }

    const user = await Users.findByPk(user_id);

    if (!user) {
      return res.status(404).send({
        status: 404,
        message: "User not found.",
      });
    }

    await user.update({
      email: cleanEmail,
      phone: cleanPhone,
    });

    const updatedUser = await getUserWithOrg({ user_id });

    return res.status(200).send({
      status: 200,
      data: updatedUser,
      message: "Profile updated successfully.",
    });
  } catch (err) {
    console.error("Update profile error:", err);

    // Extra protection for DB unique constraints
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).send({
        status: 409,
        message: "Email or phone number is already in use.",
      });
    }

    return res.status(500).send({
      status: 500,
      message: "Updating user profile failed.",
    });
  }
}