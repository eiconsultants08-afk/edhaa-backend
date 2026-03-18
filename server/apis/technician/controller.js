import { constants } from "../../constants.js";
import {
  bulkCreatePatientTestResults,
  createPatient,
  createTestHistory,
  getDeviceByIdFlat,
  getPatientByIdFlat,
  getPatients,
  getTestTypesByIds,
  getTestTypesByOrg,
  getPatientTestHistory,
  getTestResultByIdFlat,
  getTestSessionFlat,
  updatePatient,
  updateTestHistory as updateTestHistoryDb,
  updateTestResult as updateTestResultDb,
  getUserByCondition,
} from "../../database/db.js";
import { addData, failureResponse, getPaginationInfo } from "../../utils.js";
import { generateTestReportPdf, generateSessionReportPdf } from "../../pdf/reportGenerator.js";

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
    const { user_id } = req;
    const { device_id } = req.params;

    if (!device_id) return failureResponse(res, 400, "device_id is required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");
    if (!technician.org_id) return failureResponse(res, 403, "Technician org not assigned");

    const device = await getDeviceByIdFlat(device_id);
    if (!device) return failureResponse(res, 404, "Device not found");

    if (device.org_id !== technician.org_id)
      return failureResponse(res, 403, "Device not in your organization");

    return res.status(200).send({ status: 200, data: device });
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
    const patient = await getPatientByIdFlat({ patient_id });

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
      notes,
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
    const patient = await getPatientByIdFlat({ patient_id });

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

    // 3️⃣ Create the testing session (TestHistory)
    const history = await createTestHistory({
      patient_id,
      org_id: technician.org_id,
      department_id: technician.department_id || null,
      device_id: device_id || null,
      entered_by_user_id: technician.user_id,
      test_date,
      notes: notes ?? null,
    });

    // 4️⃣ Create individual result rows linked to this session
    const insertData = testArray.map(test => ({
      history_id: history.history_id,
      patient_id,
      org_id: technician.org_id,
      test_type_id: test.test_type_id,
      value_num: test.value_num ?? null,
      value_text: test.value_text ?? null,
    }));

    const testCreated = await bulkCreatePatientTestResults(insertData);

    if (!testCreated || testCreated.length === 0) return failureResponse(res, 500, "Failed to add test results");

    return res.status(201).send({
      status: 201,
      data: { history, results: testCreated },
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

export async function getTestTypes(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const testTypes = await getTestTypesByOrg(technician.org_id);

    return res.status(200).send({ status: 200, data: testTypes });
  } catch (err) {
    console.error("getTestTypes error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getPatientTests(req, res) {
  try {
    const { user_id } = req;
    const { id: patient_id, rows, page } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!patient_id) return failureResponse(res, 400, "patient_id required");

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0)
      return failureResponse(res, 400, "Invalid rows");
    if (!page || isNaN(Number(page)) || Number(page) <= 0)
      return failureResponse(res, 400, "Invalid page");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Access denied");

    const { limit, offset } = getPaginationInfo(rows, page);

    const history = await getPatientTestHistory(limit, offset, {
      patient_id,
      org_id: technician.org_id,
    });

    return res.status(200).send({ status: 200, data: history });
  } catch (err) {
    console.error("getPatientTests error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getTestResult(req, res) {
  try {
    const { user_id } = req;
    const { result_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!result_id) return failureResponse(res, 400, "result_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const result = await getTestResultByIdFlat(result_id);
    if (!result) return failureResponse(res, 404, "Test result not found");
    if (result.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");

    return res.status(200).send({ status: 200, data: result });
  } catch (err) {
    console.error("getTestResult error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getTestResultReport(req, res) {
  try {
    const { user_id } = req;
    const { result_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!result_id) return failureResponse(res, 400, "result_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const result = await getTestResultByIdFlat(result_id);
    if (!result) return failureResponse(res, 404, "Test result not found");
    if (result.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");

    const pdfBuffer = await generateTestReportPdf(result);
    const pdf_base64 = pdfBuffer.toString("base64");

    return res.status(200).send({ status: 200, data: { pdf_base64 } });
  } catch (err) {
    console.error("getTestResultReport error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function updatePatientRecord(req, res) {
  try {
    const { user_id } = req;
    const { patient_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!patient_id) return failureResponse(res, 400, "patient_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");
    if (patient.created_by !== technician.user_id) return failureResponse(res, 403, "Access denied");

    const raw = req.body || {};
    const filteredData = addData(raw, constants.UPDATE_PATIENT_ATTRIBUTES);

    if (Object.keys(filteredData).length === 0)
      return failureResponse(res, 400, "No updatable fields provided");

    const updated = await updatePatient(patient_id, filteredData);
    if (!updated) return failureResponse(res, 500, "Failed to update patient");

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Patient updated successfully",
    });
  } catch (err) {
    console.error("updatePatientRecord error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function updateTestResult(req, res) {
  try {
    const { user_id } = req;
    const { result_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!result_id) return failureResponse(res, 400, "result_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const result = await getTestResultByIdFlat(result_id);
    if (!result) return failureResponse(res, 404, "Test result not found");
    if (result.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");

    const raw = req.body || {};
    const filteredData = {};
    if (raw.value_num !== undefined) filteredData.value_num = Number(raw.value_num);
    if (raw.value_text !== undefined) filteredData.value_text = raw.value_text;

    if (Object.keys(filteredData).length === 0)
      return failureResponse(res, 400, "No updatable fields provided");

    const updated = await updateTestResultDb(result_id, filteredData);
    if (!updated) return failureResponse(res, 500, "Failed to update test result");

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Test result updated successfully",
    });
  } catch (err) {
    console.error("updateTestResult error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getSessionReport(req, res) {
  try {
    const { user_id } = req;
    const { history_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!history_id) return failureResponse(res, 400, "history_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const session = await getTestSessionFlat(history_id);
    if (!session) return failureResponse(res, 404, "Session not found");
    if (session.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");

    const pdfBuffer = await generateSessionReportPdf(session);
    const pdf_base64 = pdfBuffer.toString("base64");

    return res.status(200).send({ status: 200, data: { pdf_base64 } });
  } catch (err) {
    console.error("getSessionReport error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function updateSession(req, res) {
  try {
    const { user_id } = req;
    const { history_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!history_id) return failureResponse(res, 400, "history_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const session = await getTestSessionFlat(history_id);
    if (!session) return failureResponse(res, 404, "Session not found");
    if (session.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");

    const raw = req.body || {};
    const filteredData = addData(raw, constants.UPDATE_SESSION_ATTRIBUTES);

    if (Object.keys(filteredData).length === 0)
      return failureResponse(res, 400, "No updatable fields provided");

    const updated = await updateTestHistoryDb(history_id, filteredData);
    if (!updated) return failureResponse(res, 500, "Failed to update session");

    return res.status(200).send({ status: 200, data: updated, message: "Session updated" });
  } catch (err) {
    console.error("updateSession error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function addSessionResults(req, res) {
  try {
    const { user_id } = req;
    const { history_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!history_id) return failureResponse(res, 400, "history_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const session = await getTestSessionFlat(history_id);
    if (!session) return failureResponse(res, 404, "Session not found");
    if (session.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");

    const { tests } = req.body || {};
    if (!Array.isArray(tests) || tests.length === 0)
      return failureResponse(res, 400, "tests array required");

    const typeIds = tests.map((t) => t.test_type_id).filter(Boolean);
    if (typeIds.length === 0) return failureResponse(res, 400, "test_type_id required for each test");

    const validTypes = await getTestTypesByIds(typeIds);
    const validIdSet = new Set(validTypes.map((t) => t.test_type_id));

    const rows = tests
      .filter((t) => validIdSet.has(t.test_type_id) && (t.value_num != null || t.value_text != null))
      .map((t) => ({
        history_id,
        patient_id: session.patient_id,
        org_id: technician.org_id,
        test_type_id: t.test_type_id,
        value_num:  t.value_num  != null ? Number(t.value_num)  : null,
        value_text: t.value_text != null ? String(t.value_text) : null,
      }));

    if (rows.length === 0) return failureResponse(res, 400, "No valid test results to add");

    await bulkCreatePatientTestResults(rows);

    return res.status(200).send({ status: 200, data: rows, message: "Results added to session" });
  } catch (err) {
    console.error("addSessionResults error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}