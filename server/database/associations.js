import Organization from "./organization.js";
import Department from "./department.js";
import Users from "./users.js";
import Patients from "./patients.js";
import Devices from "./devices.js";
import Tokens from "./tokens.js";
import TestTypes from "./test_types.js";
import TestHistory from "./test_history.js";
import PatientTestResults from "./patient_test_results.js";
import Plans from "./plans.js";
import PlanTestTypes from "./plan_test_types.js";

// ── Plans ──────────────────────────────────────────────────────────────────────
Plans.hasMany(Organization, { foreignKey: "plan_id", as: "organizations" });
Organization.belongsTo(Plans, { foreignKey: "plan_id", as: "plan" });

// ── Plans ↔ TestTypes (global catalogue, org-independent) ─────────────────────
Plans.belongsToMany(TestTypes, { through: PlanTestTypes, foreignKey: "plan_id", otherKey: "test_type_id", as: "testTypes" });
TestTypes.belongsToMany(Plans, { through: PlanTestTypes, foreignKey: "test_type_id", otherKey: "plan_id", as: "plans" });

// ── TestHistory ────────────────────────────────────────────────────────────────
Patients.hasMany(TestHistory, { foreignKey: "patient_id", as: "testHistory" });
TestHistory.belongsTo(Patients, { foreignKey: "patient_id", as: "patient" });

TestHistory.belongsTo(Users, { foreignKey: "entered_by_user_id", as: "enteredBy" });
TestHistory.belongsTo(Devices, { foreignKey: "device_id", as: "device" });
TestHistory.belongsTo(Organization, { foreignKey: "org_id", as: "org" });
TestHistory.belongsTo(Department, { foreignKey: "department_id", as: "department" });

// ── PatientTestResults ─────────────────────────────────────────────────────────
TestHistory.hasMany(PatientTestResults, { foreignKey: "history_id", as: "results" });
PatientTestResults.belongsTo(TestHistory, { foreignKey: "history_id", as: "history" });

PatientTestResults.belongsTo(Patients, { foreignKey: "patient_id", as: "patient" });
PatientTestResults.belongsTo(TestTypes, { foreignKey: "test_type_id", as: "testType" });
TestTypes.hasMany(PatientTestResults, { foreignKey: "test_type_id", as: "results" });
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
  Plans,
  PlanTestTypes,
};
