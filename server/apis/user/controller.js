import { getUserByCondition } from "../../database/db.js";

//show user profile
export async function userProfile(req, res) {
  try {
    const { user_id } = req;
    const user = await getUserByCondition({user_id});
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