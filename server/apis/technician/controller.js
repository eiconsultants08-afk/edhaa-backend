import { constants } from "../../constants.js";
import {
  bulkCreatePatientTestResults,
  bulkUpdateTestResultsBySession,
  createPatient,
  createTestHistory,
  getDeviceByIdFlat,
  getDevicesByTechnician,
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
  countUnfilledResults,
  getResultsForCsvExport,
  getOrgById,
  createUartTestResult,
  getPatientSessionsOnDate,
} from "../../database/db.js";
import { addData, buildTestResultsCsv, failureResponse, getPaginationInfo } from "../../utils.js";
import moment from "moment-timezone";
import { generateTestReportPdf, generateSessionReportPdf, generateBulkReportPdf } from "../../pdf/reportGenerator.js";

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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const { limit, offset } = getPaginationInfo(rows, page);

    const conditions = {
      org_id: technician.org_id,
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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

export async function getMyDevices(req, res) {
  try {
    const { user_id } = req;

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const devices = await getDevicesByTechnician(user_id);

    return res.status(200).send({ status: 200, data: devices });
  } catch (err) {
    console.error("getMyDevices error:", err);
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    // 3️⃣ Fetch patient
    const patient = await getPatientByIdFlat({ patient_id });

    if (!patient) return failureResponse(res, 404, "Patient not found");

    // 4️⃣ Org validation
    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Access denied, organization mismatch");

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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
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

export async function registerTestSession(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const { patient_id, test_date, device_id, notes, test_type_ids } = req.body || {};

    if (!patient_id) return failureResponse(res, 400, "patient_id required");
    if (!test_date) return failureResponse(res, 400, "test_date required");
    if (!Array.isArray(test_type_ids) || test_type_ids.length === 0)
      return failureResponse(res, 400, "test_type_ids array required");

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Access denied");

    const testTypes = await getTestTypesByIds(test_type_ids);
    if (testTypes.length !== test_type_ids.length)
      return failureResponse(res, 400, "Invalid test_type_id");
    for (const tt of testTypes) {
      if (tt.org_id !== technician.org_id)
        return failureResponse(res, 403, "Test type access denied");
    }

    const history = await createTestHistory({
      patient_id,
      org_id: technician.org_id,
      department_id: technician.department_id || null,
      device_id: device_id || null,
      entered_by_user_id: technician.user_id,
      test_date,
      notes: notes ?? null,
      status: "PENDING",
    });

    const insertData = test_type_ids.map(id => ({
      history_id: history.history_id,
      patient_id,
      org_id: technician.org_id,
      test_type_id: id,
      value_num: null,
      value_text: null,
    }));
    const results = await bulkCreatePatientTestResults(insertData);

    return res.status(201).send({
      status: 201,
      data: { history, results },
      message: "Test session registered successfully",
    });
  } catch (err) {
    console.error("registerTestSession error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function completeTestSession(req, res) {
  try {
    const { user_id } = req;
    const { history_id } = req.params;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!history_id) return failureResponse(res, 400, "history_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const { tests, notes, complete, device_id } = req.body || {};

    const session = await getTestSessionFlat(history_id);
    if (!session) return failureResponse(res, 404, "Session not found");
    if (session.org_id !== technician.org_id)
      return failureResponse(res, 403, "Access denied");
    if (session.status === "COMPLETED")
      return failureResponse(res, 400, "Session already completed");

    // Save any provided values first
    if (Array.isArray(tests) && tests.length > 0) {
      const filledTests = tests.filter(t =>
        t.value_num != null || (t.value_text != null && t.value_text !== "")
      );
      if (filledTests.length > 0) {
        await bulkUpdateTestResultsBySession(history_id, filledTests);
      }
    }

    // Status is driven entirely by the complete flag — never auto-completed
    const newStatus = complete === true ? "COMPLETED" : "PENDING";
    const historyUpdate = { status: newStatus };
    if (notes !== undefined) historyUpdate.notes = notes;
    // Lock device on first save — cannot be changed once set
    if (device_id && !session.device_id) historyUpdate.device_id = device_id;
    const updated = await updateTestHistoryDb(history_id, historyUpdate);

    const message = newStatus === "COMPLETED"
      ? "Test session completed"
      : "Test values saved";

    return res.status(200).send({
      status: 200,
      data: updated,
      message,
    });
  } catch (err) {
    console.error("completeTestSession error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getTestTypes(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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
  return failureResponse(res, 403, "Technicians cannot edit patient information");
}

export async function updateTestResult(req, res) {
  try {
    const { user_id } = req;
    const { result_id } = req.params;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!result_id) return failureResponse(res, 400, "result_id required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User not active");
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

/**
 * GET /technician/patient/:patient_id/report?date=YYYY-MM-DD
 * Aggregates every session on that date into a single PDF.
 */
export async function getPatientDateReport(req, res) {
  try {
    const { user_id } = req;
    const { patient_id } = req.params;
    const { date } = req.query;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");
    if (!patient_id) return failureResponse(res, 400, "patient_id required");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return failureResponse(res, 400, "date (YYYY-MM-DD) required");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const bundle = await getPatientSessionsOnDate(patient_id, date);
    if (!bundle) return failureResponse(res, 404, "Patient not found");
    if (bundle.patient.org_id !== technician.org_id) return failureResponse(res, 403, "Access denied");
    if (!bundle.results.length) return failureResponse(res, 404, "No tests found for this date");

    const firstHist = bundle.histories[0] || {};
    const session = {
      org_name: firstHist.org_name || "",
      department_name: firstHist.department_name || "",
      test_date: `${date}T00:00:00Z`,
      patient_id: bundle.patient.patient_id,
      patient_name: bundle.patient.name,
      patient_gender: bundle.patient.gender,
      patient_dob: bundle.patient.dob,
      results: bundle.results,
    };

    const pdfBuffer = await generateSessionReportPdf(session);
    const pdf_base64 = pdfBuffer.toString("base64");
    const [y, m, d] = date.split("-");
    const filename = `${bundle.patient.patient_id}_${d}-${m}-${y}.pdf`;

    return res.status(200).send({ status: 200, data: { pdf_base64, filename } });
  } catch (err) {
    console.error("getPatientDateReport error:", err);
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING") return failureResponse(res, 403, "User is not active");
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
        patient_id:   session.patient_id,
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

export async function generateCsvReportTechnician(req, res) {
  try {
    const { user_id } = req;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const IST = "Asia/Kolkata";
    const { startDate: rawStart, endDate: rawEnd } = req.query;

    if (!rawStart || !rawEnd)
      return failureResponse(res, 400, "startDate and endDate query params are required (YYYY-MM-DD)");

    const startDate = moment.tz(rawStart, "YYYY-MM-DD", IST).startOf("day").toISOString();
    const endDate   = moment.tz(rawEnd,   "YYYY-MM-DD", IST).endOf("day").toISOString();

    const histories = await getResultsForCsvExport(
      technician.org_id,
      startDate,
      endDate,
      technician.user_id,
    );

    const csv_base64 = buildTestResultsCsv(histories);

    return res.status(200).send({
      status: 200,
      data: { csv_base64, filename: `report_${rawStart}_to_${rawEnd}.csv` },
      message: `${histories.length} sessions exported`,
    });
  } catch (err) {
    console.error("generateCsvReportTechnician error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function generatePdfReportTechnician(req, res) {
  try {
    const { user_id } = req;

    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User is not active");
    if (technician.role !== constants.TECHNICIAN) return failureResponse(res, 403, "Forbidden");

    const IST = "Asia/Kolkata";
    const { startDate: rawStart, endDate: rawEnd } = req.query;

    if (!rawStart || !rawEnd)
      return failureResponse(res, 400, "startDate and endDate query params are required (YYYY-MM-DD)");

    const startDate = moment.tz(rawStart, "YYYY-MM-DD", IST).startOf("day").toISOString();
    const endDate   = moment.tz(rawEnd,   "YYYY-MM-DD", IST).endOf("day").toISOString();

    const histories = await getResultsForCsvExport(
      technician.org_id,
      startDate,
      endDate,
      technician.user_id,
    );

    const org = await getOrgById(technician.org_id);

    const pdfBuffer = await generateBulkReportPdf(histories, {
      orgName:        org?.org_name || "EDHAA Diagnostic",
      deptName:       "",
      startDate:      rawStart,
      endDate:        rawEnd,
      performerLabel: `Technician: ${technician.name || technician.username}`,
    });

    const pdf_base64 = pdfBuffer.toString("base64");
    const filename   = `report_${rawStart}_to_${rawEnd}.pdf`;

    return res.status(200).send({
      status: 200,
      data: { pdf_base64, filename },
      message: `${histories.length} sessions exported`,
    });
  } catch (err) {
    console.error("generatePdfReportTechnician error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function submitUartResult(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const { patient_id, test, val, method } = req.body || {};

    if (!patient_id) return failureResponse(res, 400, "patient_id required");
    if (!test)       return failureResponse(res, 400, "test required");
    if (val == null) return failureResponse(res, 400, "val required");

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Patient not in your organization");

    const history = await createUartTestResult({
      patient_id,
      test_name:          test,
      value_num:          Number(val),
      method_used:        method || null,
      entered_by_user_id: technician.user_id,
      department_id:      technician.department_id || null,
      org_id:             technician.org_id,
    });

    return res.status(201).send({
      status: 201,
      data: { history_id: history.history_id },
      message: "Result stored successfully",
    });
  } catch (err) {
    console.error("submitUartResult error:", err);
    return res.status(500).send({ status: 500, message: err.message || "Internal server error" });
  }
}