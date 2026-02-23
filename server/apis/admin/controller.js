// controller.js
import { failureResponse, getPaginationInfo } from "../../utils.js";
import { getDevices, getUserById } from "../../database/db.js";



export async function getAllDevices(req, res) {
  try {
    // 1) Auth check (use whatever your middleware sets)
    const {id} = req; // support both styles

    // 2) Validate params
    const { rows, page } = req.params;

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) {
      return failureResponse(res, 400, "Invalid rows");
    }
    if (!page || isNaN(Number(page)) || Number(page) <= 0) {
      return failureResponse(res, 400, "Invalid page");
    }

    // 3) Load admin context
    const admin = await getUserById(id);
    if (!admin) return failureResponse(res, 404, "User not found");

    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== "ADMIN") return failureResponse(res, 403, "Forbidden");

    // 4) Org/Dept must exist
    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
    if (!admin.department_id) return failureResponse(res, 403, "Admin department not assigned");

    // 5) Pagination
    const { limit, offset } = getPaginationInfo(rows, page);

    // 6) Conditions object (like your getAllUsers pattern)
    const conditions = {
      org_id: admin.org_id,
      department_id: admin.department_id,
    };

    const result = await getDevices(limit, offset, conditions); // returns { count, rows }

    return res.status(200).send({
      status: 200,
      data: result, // ✅ same structure you showed
      message:`Devices of ${admin.name}` 
    });
  } catch (err) {
    console.error("getAllDevices error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}