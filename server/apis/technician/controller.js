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
  getOrgPlanTestTypeIds,
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
  createUartTestResults,
  updateUartSession,
} from "../../database/db.js";
import { addData, failureResponse, getPaginationInfo } from "../../utils.js";
import { buildTestResultsXlsx } from "../../pdf/excelReportGenerator.js";
import moment from "moment-timezone";
import { generateTestReportPdf, generateSessionReportPdf, generateBulkReportPdf } from "../../pdf/reportGenerator.js";
import sequelize from "../../database/connectdb.js";
import TestHistory from "../../database/test_history.js";
import PatientTestResults from "../../database/patient_test_results.js";
import TestTypes from "../../database/test_types.js";

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

    const validIds = await getOrgPlanTestTypeIds(test_type_ids, technician.org_id);
    if (validIds.size !== test_type_ids.length)
      return failureResponse(res, 400, "Invalid or unauthorized test type");

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

export async function getSessionReport(req, res) {
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

    const org = await getOrgById(technician.org_id);
    const xlsxBuffer = await buildTestResultsXlsx(histories, {
      orgName:    org?.org_name || "EDHAA Diagnostic",
      orgAddress: org?.address  || "",
    });
    const xlsx_base64 = Buffer.from(xlsxBuffer).toString("base64");

    return res.status(200).send({
      status: 200,
      data: { xlsx_base64, filename: `report_${rawStart}_to_${rawEnd}.xlsx` },
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
      orgAddress:     org?.address  || "",
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

// Accepts an array of UART readings — each creates its own session + result row.
// Body: [{ patient_id, test, val, unit, raw }, ...]
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

    const body = req.body;
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      if (!item.patient_id) return failureResponse(res, 400, "patient_id required in each entry");
      if (!item.test)       return failureResponse(res, 400, "test required in each entry");
      if (item.val == null) return failureResponse(res, 400, "val required in each entry");
    }

    // Validate all patients belong to the technician's org
    for (const item of items) {
      const patient = await getPatientByIdFlat({ patient_id: String(item.patient_id) });
      if (!patient) return failureResponse(res, 404, `Patient ${item.patient_id} not found`);
      if (patient.org_id !== technician.org_id)
        return failureResponse(res, 403, `Patient ${item.patient_id} not in your organization`);
    }

    const entries = items.map(item => ({
      patient_id:  String(item.patient_id),
      test_name:   item.test,
      value_num:   Number(item.val),
      method_used: item.method || null,
    }));

    const created = await createUartTestResults({
      entries,
      entered_by_user_id: technician.user_id,
      department_id:      technician.department_id || null,
      org_id:             technician.org_id,
    });

    return res.status(201).send({
      status: 201,
      data: created,
      message: "Results stored successfully",
    });
  } catch (err) {
    console.error("submitUartResult error:", err);
    return res.status(500).send({ status: 500, message: err.message || "Internal server error" });
  }
}

export async function submitUartSessionComplete(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const technician = await getUserByCondition({ user_id });
    if (!technician) return failureResponse(res, 404, "User not found");
    if (technician.status !== "ACTIVE" && technician.status !== "WORKING")
      return failureResponse(res, 403, "User not active");
    if (technician.role !== constants.TECHNICIAN)
      return failureResponse(res, 403, "Forbidden");

    const { patient_id, results } = req.body || {};

    if (!patient_id)                                     return failureResponse(res, 400, "patient_id required");
    if (!Array.isArray(results) || results.length === 0) return failureResponse(res, 400, "results array required");

    for (const r of results) {
      if (!r.test_name)                         return failureResponse(res, 400, "each result must have test_name");
      if (r.value_num == null && !r.value_text) return failureResponse(res, 400, `value_num or value_text required for "${r.test_name}"`);
    }

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== technician.org_id)
      return failureResponse(res, 403, "Patient not in your organization");

    const { history_id } = await updateUartSession({
      patient_id,
      org_id: technician.org_id,
      results,
    });

    return res.status(200).send({
      status: 200,
      data: { history_id },
      message: "Session updated and completed successfully",
    });
  } catch (err) {
    console.error("submitUartSessionComplete error:", err);
    return res.status(500).send({ status: 500, message: err.message || "Internal server error" });
  }
}

export const saveUartResult = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { patient_id, test, val, unit, raw } = req.body;

    if (!patient_id || !test) {
      await transaction.rollback();
      return failureResponse(res, 400, "patient_id and test are required");
    }

    const technician = await getUserByCondition({ user_id: req.user_id || req.user?.user_id || req.user_id });

    const patient = await getPatientByIdFlat({
      patient_id: String(patient_id),
    });

    if (!patient) {
      await transaction.rollback();
      return failureResponse(res, 404, `Patient ${patient_id} not found`);
    }

    const history = await TestHistory.findOne({
      where: {
        patient_id: String(patient_id),
        status: "PENDING",
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (!history) {
      await transaction.rollback();
      return failureResponse(res, 400, "Please register test session first");
    }

    const testType = await TestTypes.findOne({
      where: {
        name: test,
        org_id: history.org_id,
      },
      transaction,
    });

    if (!testType) {
      await transaction.rollback();
      return failureResponse(res, 404, `Test type not found for ${test}`);
    }

    const existingResult = await PatientTestResults.findOne({
      where: {
        history_id: history.history_id,
        patient_id: String(patient_id),
        test_type_id: testType.test_type_id,
      },
      transaction,
    });

    if (!existingResult) {
      await transaction.rollback();
      return failureResponse(
        res,
        400,
        `${test} was not selected in registered test session`
      );
    }

    if (
      existingResult.value_num !== null ||
      existingResult.value_text !== null
    ) {
      await transaction.rollback();
      return failureResponse(
        res,
        409,
        `${test} already has a saved value in this session`
      );
    }

    const isNumeric =
      val !== null &&
      val !== undefined &&
      val !== "" &&
      !Number.isNaN(Number(val));

    await PatientTestResults.update(
      {
        value_num: isNumeric ? Number(val) : null,
        value_text: isNumeric ? null : String(val),
        raw_value: raw ? String(raw) : null,
        result_source: "UART",
        synced_at: new Date(),
        is_locked: true,
        method_used: "UART Console",
      },
      {
        where: {
          result_id: existingResult.result_id,
        },
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).send({
      status: 200,
      data: {
        history_id: history.history_id,
        result_id: existingResult.result_id,
      },
      message: "UART result saved successfully",
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Save UART result error:", error);

    return res.status(500).send({
      status: 500,
      message: "Failed to save UART result",
      error: error.message,
    });
  }
};