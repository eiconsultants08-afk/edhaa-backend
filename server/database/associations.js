import Organization from "./organization.js";
import Department from "./department.js";
import Users from "./users.js";
import Patients from "./patients.js";
import Devices from "./devices.js";
import Tokens from "./tokens.js";
import TestTypes from "./test_types.js";
import PatientTestResults from "./patient_test_results.js";

// ---------------- Associations ----------------

// TestTypes
TestTypes.belongsTo(Organization, { foreignKey: "org_id", as: "org" });
Organization.hasMany(TestTypes, { foreignKey: "org_id", as: "testTypes" });

// PatientTestResults relations
PatientTestResults.belongsTo(Organization, { foreignKey: "org_id", as: "org" });
PatientTestResults.belongsTo(Department, { foreignKey: "department_id", as: "department" });
PatientTestResults.belongsTo(Patients, { foreignKey: "patient_id", as: "patient" });
PatientTestResults.belongsTo(TestTypes, { foreignKey: "test_type_id", as: "testType" });
PatientTestResults.belongsTo(Users, { foreignKey: "entered_by_user_id", as: "enteredBy" });
PatientTestResults.belongsTo(Devices, { foreignKey: "device_id", as: "device" });

export { Organization, Department, Users, Patients, Devices, Tokens,  TestTypes, PatientTestResults };