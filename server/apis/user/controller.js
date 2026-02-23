
//show user profile
export async function userProfile(req, res) {
  try {
    const { id } = req;
    const user = await getUserById(id);
    if (user) {
      let data = {};
      
      for (const prop of constants.USER_PROFILE) {
        if (prop === 'org_id') {
          data['organization'] = await getOrganizationName(user[prop]);
          data['org_id'] = user[prop];
        } else {
          data[prop] = user[prop];
        }
      }

      res.status(200).send({
        status: 200,
        data: data,
        message: `Data of User ${id}`,
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