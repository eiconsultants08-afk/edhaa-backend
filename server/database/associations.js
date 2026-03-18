import Organization from "./organization.js";
import Department from "./department.js";
import Users from "./users.js";
import Patients from "./patients.js";
import Devices from "./devices.js";
import Tokens from "./tokens.js";
import TestTypes from "./test_types.js";
import TestHistory from "./test_history.js";
import PatientTestResults from "./patient_test_results.js";

// ── TestTypes ──────────────────────────────────────────────────────────────────
TestTypes.belongsTo(Organization, { foreignKey: "org_id", as: "org" });
Organization.hasMany(TestTypes, { foreignKey: "org_id", as: "testTypes" });

// ── TestHistory ────────────────────────────────────────────────────────────────
// A patient has many testing sessions
Patients.hasMany(TestHistory, { foreignKey: "patient_id", as: "testHistory" });
TestHistory.belongsTo(Patients, { foreignKey: "patient_id", as: "patient" });

// Each session was entered by a technician
TestHistory.belongsTo(Users, { foreignKey: "entered_by_user_id", as: "enteredBy" });

// Each session optionally used a device
TestHistory.belongsTo(Devices, { foreignKey: "device_id", as: "device" });

// Org + department scoping
TestHistory.belongsTo(Organization, { foreignKey: "org_id", as: "org" });
TestHistory.belongsTo(Department, { foreignKey: "department_id", as: "department" });

// ── PatientTestResults ─────────────────────────────────────────────────────────
// Each result belongs to a session (TestHistory)
TestHistory.hasMany(PatientTestResults, { foreignKey: "history_id", as: "results" });
PatientTestResults.belongsTo(TestHistory, { foreignKey: "history_id", as: "history" });

// Direct patient link (for queries that don't need to go through TestHistory)
PatientTestResults.belongsTo(Patients, { foreignKey: "patient_id", as: "patient" });

// Test type lookup
PatientTestResults.belongsTo(TestTypes, { foreignKey: "test_type_id", as: "testType" });
TestTypes.hasMany(PatientTestResults, { foreignKey: "test_type_id", as: "results" });

// Org scoping
PatientTestResults.belongsTo(Organization, { foreignKey: "org_id", as: "org" });

export {
  Organization,
  Department,
  Users,
  Patients,
  Devices,
  Tokens,
  TestTypes,
  TestHistory,
  PatientTestResults,
};
