import { bulkCreatePatientTestResults, createPatient, getDeviceByIdFlat, getPatientByIdFlat, getPatients, getTestTypesByIds } from "../../database/db.js";
import { addData, failureResponse, getPaginationInfo } from "../../utils.js";

export async function getAllPatients(req, res) {
  try {
    const { user_id } = req;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const { rows, page } = req.params;

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0)
      return failureResponse(res, 400, "Invalid rows");

    if (!page || isNaN(Number(page)) || Number(page) <= 0)
      return failureResponse(res, 400, "Invalid page");

    const technician = await getUserByCondition({ user_id });

    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const { limit, offset } = getPaginationInfo(rows, page);

    const conditions = {
      org_id: technician.org_id,
      created_by: technician.user_id,
    };

    const patients = await getPatients(
      limit,
      offset,
      conditions
    );

    return res.status(200).send({
      status: 200,
      data: patients,
    });
  } catch (err) {
    console.error("getAllPatients error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getDeviceByDeviceId(req, res) {
    try {
        const {user_id} = req;

        const { device_id } = req.params;
        if (!device_id) return failureResponse(res, 400, "device_id is required");

        const admin = await getUserByCondition({user_id});
        if (!admin) return failureResponse(res, 404, "User not found");

        if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
        if (admin.role !== "ADMIN") return failureResponse(res, 403, "Forbidden");

        if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
        if (!admin.department_id) return failureResponse(res, 403, "unknown department");

        // ✅ Single query by device_id (with joins + flat)
        const device = await getDeviceByIdFlat(device_id);
        if (!device) return failureResponse(res, 404, "Device not found");

        // ✅ Scope check (authorization)
        if (device.org_id !== admin.org_id)
            return failureResponse(res, 403, "Device not in your organization");

        if (device.department_id !== admin.department_id)
            return failureResponse(res, 403, "Device not in your department");

        return res.status(200).send({
            status: 200,
            data: device, // ✅ flat
        });
    } catch (err) {
        console.error("getDeviceByDeviceId error:", err);
        return res.status(500).send({ status: 500, message: "Internal server error" });
    }
}

export async function getPatientById(req, res) {
  try {
    const { user_id } = req;
    const { patient_id } = req.params;

    // 1️⃣ Auth check
    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!patient_id) return failureResponse(res, 400, "Patient id required");

    // 2️⃣ Load technician
    const technician = await getUserByCondition({ user_id });

    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    // 3️⃣ Fetch patient
    const patient = await getPatientByIdFlat({patient_id});

    if (!patient) return failureResponse(res, 404, "Patient not found");

    // 4️⃣ Org validation
    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Access denied, organization mismatch");

    // 5️⃣ Ownership validation
    if (patient.created_by !== technician.user_id)
      return failureResponse(res, 403, "Access denied, patient not created by");

    return res.status(200).send({
      status: 200,
      data: patient,
    });
  } catch (err) {
    console.error("getPatientById error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addPatient(req, res) {
  try {
    const { user_id } = req;

    // 1️⃣ Auth check
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    // 2️⃣ Load technician
    const technician = await getUserByCondition({ user_id });

    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    if (!technician.org_id)
      return failureResponse(res, 403, "Technician org not assigned");

    // 3️⃣ Validate body
    const raw = req.body || {};

    if (!raw.name || raw.name.trim() === "")
      return failureResponse(res, 400, "Patient name is required");

    // 4️⃣ Filter allowed fields (SQL injection safe)
    const filteredData = addData(raw, constants.ADD_PATIENT_ATTRIBUTES);

    const payload = {
      ...filteredData,
      org_id: technician.org_id,
      created_by: technician.user_id,
    };

    const created = await createPatient(payload);

    return res.status(201).send({
      status: 201,
      data: created,
      message: "Patient created successfully",
    });
  } catch (err) {
    console.error("addPatient error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addPatientTestResults(req, res) {
  try {
    const { user_id } = req;

    if (!user_id)
      return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });

    if (!technician)
      return failureResponse(res, 404, "User not found");

    if (technician.status !== "ACTIVE")
      return failureResponse(res, 403, "User not active");

    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const {
      patient_id,
      test_date,
      device_id,
      test_type_id,
      value_num,
      value_text,
      tests
    } = req.body || {};

    if (!patient_id)
      return failureResponse(res, 400, "patient_id required");

    if (!test_date)
      return failureResponse(res, 400, "test_date required");

    // ✅ Normalize into array
    let testArray = [];

    if (Array.isArray(tests) && tests.length > 0) {
      testArray = tests;
    } else if (test_type_id) {
      testArray = [
        {
          test_type_id,
          value_num,
          value_text
        }
      ];
    } else {
      return failureResponse(res, 400, "No test data provided");
    }

    // 1️⃣ Validate patient
    const patient = await getPatientByIdFlat({patient_id});

    if (!patient)
      return failureResponse(res, 404, "Patient not found");

    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Access denied");

    if (patient.created_by !== technician.user_id)
      return failureResponse(res, 403, "Access denied");

    // 2️⃣ Validate test types
    const testTypeIds = testArray.map(t => t.test_type_id);

    const testTypes = await getTestTypesByIds(testTypeIds);

    if (testTypes.length !== testTypeIds.length)
      return failureResponse(res, 400, "Invalid test_type_id");

    for (const tt of testTypes) {
      if (tt.org_id !== technician.org_id)
        return failureResponse(res, 403, "Test type access denied");
    }

    // 3️⃣ Prepare insert payload
    const insertData = testArray.map(test => ({
      org_id: technician.org_id,
      department_id: technician.department_id || null,
      patient_id,
      test_type_id: test.test_type_id,
      device_id: device_id || null,
      entered_by_user_id: technician.user_id,
      test_date,
      value_num: test.value_num ?? null,
      value_text: test.value_text ?? null,
      notes: test.notes ?? null,
    }));

    const testCreated = await bulkCreatePatientTestResults(insertData);

    if(!testCreated || testCreated.length === 0) return failureResponse(res, 500, "Failed to add test results"); 

    return res.status(201).send({
      status: 201,
      data: testCreated,
      message: "Test result(s) added successfully"
    });

  } catch (err) {
    console.error("addPatientTestResults error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error"
    });
  }
}