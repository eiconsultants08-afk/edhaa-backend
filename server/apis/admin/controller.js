// import {
//   getPaginationInfo,
//   hashPassword,
//   updateData,
//   addData,
// } from "../../utils.js";
// import { constants } from "../../constants.js";
// import {
//   getAllUsers,
//   createUser,
//   updateUser,
// } from "../../database/db.js";
// import sequelize from "../../database/connectdb.js";


// export async function addUser(req, res) {
//   try {
//     // Format request body
//     const userData = addData(req.body, constants.ADD_USER_ATTRIBUTES);

//     const hashedPassword = await hashPassword(userData.password);
//     userData['password'] = hashedPassword;
//     userData['role'] = constants.USER;
    
//     // Fetch or create organization and get the org_id
//     const org_id = await addOrganizationName(userData.organization_name);
//     userData['org_id'] = org_id;

//     // Remove organization_name from userData as it's not needed in the Users table
//     delete userData.organization_name;

//     // Creates User
//     await createUser(userData);

//     res.status(201).send({
//       status: 201,
//       message: "User created successfully.",
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(400).send({
//       status: 400,
//       message: "User creation failed.",
//     });
//   }
// }

// export async function getUsers(req, res) {
//   try {
//     const { rows, page } = req.params;
//     const { limit, offset } = getPaginationInfo(rows, page);

//     const users = await getAllUsers(limit, offset);

//     res.status(200).send({
//       status: 200,
//       data: users,
//       message: `Data of all Users`,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(400).send({
//       status: 400,
//       message: "Displaying users data failed.",
//     });
//   }
// }

// //show user profile
// export async function userProfile(req, res) {
//   try {
//     const { id } = req.params;
//     const user = await getUserById(id);
//     let data = {};

//     for (const prop of constants.ADMIN_USER_PROFILE) {
//       if (prop === 'org_id') {
//         data['organization'] = await getOrganizationName(user[prop]);
//       } else {
//         data[prop] = user[prop];
//       }
//     }

//     if (user) {
//       res.status(200).send({
//         status: 200,
//         data: data,
//         message: `Data of User ${id}`,
//       });
//     } else {
//       res.status(404).send({
//         status: 404,
//         message: "Invalid User",
//       });
//     }
//   } catch(err) {
//     console.error(err);
//     res.status(400).send({
//       status: 400,
//       message: "Displaying user profile failed.",
//     });
//   }
// }

// // update user profile
// export async function updateUserProfile(req, res) {
//   const transaction = await sequelize.transaction();
//   try {
//     const { id } = req.params;
//     let newUserData = req.body;

//     const oldUserData = await getUserById(id);
//     if (oldUserData) {
//       const newData = updateData(newUserData, oldUserData, constants.UPDATE_USER_PROFILE);

//       // Check if the password needs to be hashed
//       if ('password' in newData) {
//         const hashedPassword = await hashPassword(newData.password);
//         newData['password'] = hashedPassword;
//       }

//       // Proceed with updating the user data if there are changes
//       if (Object.keys(newData).length !== 0) {
//         const condition = { id: id };
//         await updateUser(newData, oldUserData, condition, transaction);
//       }

//       // Commit the transaction
//       await transaction.commit();

//       res.status(200).send({
//         status: 200,
//         message: `Data updated.`,
//       });

//     } else {
//       await transaction.rollback();
//       res.status(404).send({
//         status: 404,
//         message: `User ${id} not found.`,
//       });
//     }
//   } catch (err) {
//     console.error(err);
//     await transaction.rollback();
//     res.status(400).send({
//       status: 400,
//       message: "Updating user profile failed.",
//     });
//   }
// }