# EDHAA Backend Documentation

EDHAA Backend is a Node.js/Express API for managing organizations, users, medical devices, patients, diagnostic test sessions, test results, analytics, and generated reports. It uses PostgreSQL through Sequelize and supports role-based access for super admins, organization admins, and technicians.

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Runtime Configuration](#runtime-configuration)
- [Local Setup](#local-setup)
- [Application Startup](#application-startup)
- [Authentication and Authorization](#authentication-and-authorization)
- [User Roles](#user-roles)
- [Database Model Summary](#database-model-summary)
- [API Reference](#api-reference)
- [Reports and Files](#reports-and-files)
- [Important Workflows](#important-workflows)
- [Operational Notes](#operational-notes)
- [Known Gaps](#known-gaps)

## Project Overview

The backend exposes APIs for the EDHAA diagnostic platform:

- Super admins manage organizations, organization admins, technicians, devices, test catalogues, and plans.
- Organization admins manage technicians, devices, patients, test sessions, analytics, and reports for their own organization.
- Technicians manage patients, register test sessions, submit results, complete sessions, and generate patient reports.
- Users authenticate with JWT access tokens and refresh tokens.
- Patient reports can be generated as CSV or PDF.
- UART/device result ingestion is supported for technician workflows.

The service starts from `server/app.js` and mounts all feature routes from `server/routes.js`.

## Technology Stack

- Runtime: Node.js with ES modules
- Web framework: Express
- Database: PostgreSQL
- ORM: Sequelize
- Authentication: JSON Web Tokens and bcrypt
- AWS integrations: SSM Parameter Store, S3, SES
- Reporting: PDFKit, ExcelJS, json2csv
- Device/result ingestion helpers: UART-oriented endpoints
- Development runner: nodemon

## Folder Structure

```text
edhaa-backend/
|-- package.json
|-- README.md
`-- server/
    |-- app.js                         # Express app, middleware, health route, DB startup
    |-- routes.js                      # Mounts route modules
    |-- config.js                      # dev/prod config built from secrets
    |-- constants.js                   # runtime environment and shared constants
    |-- utils.js                       # JWT, password, pagination, AWS/S3/CSV helpers
    |-- secret/
    |   `-- secrets.js                 # Loads .env locally or AWS SSM in prod
    |-- middleware/
    |   `-- auth.js                    # JWT and role middleware
    |-- database/
    |   |-- connectdb.js               # Sequelize PostgreSQL connection
    |   |-- associations.js            # Sequelize associations
    |   |-- db.js                      # Data access helpers
    |   `-- *.js                       # Sequelize models
    |-- apis/
    |   |-- auth/
    |   |-- user/
    |   |-- admin/
    |   |-- technician/
    |   `-- superadmin/
    `-- pdf/
        |-- reportGenerator.js
        `-- excelReportGenerator.js
```

## Runtime Configuration

The active environment is selected from the second CLI argument:

```bash
node server/app.js dev
node server/app.js prod
```

If no argument is provided, the app defaults to `dev`.

Configuration is defined in `server/config.js` and loaded through `server/constants.js`.

### Required Environment Variables

For local development, create a `.env` file in the project root. `server/secret/secrets.js` loads this file when the app is not running in `prod`.

```env
DB_USERNAME=postgres_user
DB_PASSWORD=postgres_password
DB_NAME=database_name
DB_HOST=localhost
secrets=access_token_secret
refresh_secret=refresh_token_secret
```

In production, the same names are loaded from AWS Systems Manager Parameter Store in region `ap-south-1`.

### Server Defaults

- Port: `3030`
- Host binding: `0.0.0.0`
- Health check: `GET /health`
- Default environment: `dev`
- PostgreSQL SSL: enabled automatically when `DB_HOST` is not `localhost`

### CORS Origins

Allowed UI origins are configured in `server/config.js`. The app also allows requests without an `Origin` header, which is useful for React Native, Postman, and curl.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

The `start` script runs:

```bash
nodemon server/app.js
```

Check the service:

```bash
curl http://localhost:3030/health
```

Expected response:

```text
OK
```

## Application Startup

When the server starts, `server/app.js` performs the following steps:

1. Creates the Express app.
2. Configures CORS.
3. Enables JSON and URL-encoded body parsing with a `50mb` limit.
4. Registers `GET /health`.
5. Mounts feature routes.
6. Starts listening on `0.0.0.0:${config.port}`.
7. Authenticates with PostgreSQL.
8. Runs several idempotent schema patch queries.
9. Runs `sequelize.sync()`.
10. Synchronizes technician statuses based on token and device assignment state.

The startup-time schema patches currently handle:

- Making `users.email` nullable.
- Migrating `patients.patient_id` to text.
- Dropping legacy `patient_code` columns.
- Creating patient and organization numeric sequences.
- Adding `test_histories.status`.
- Adding extended BIO-CHEQ metadata fields to `test_types`.
- Adding `method_used` to `patient_test_results`.
- Adding `specimen_type` to `test_types`.
- Enforcing `patient_test_results.history_id` as not null.
- Making `tokens.org_id` nullable for super admin refresh tokens.

## Authentication and Authorization

Authentication is JWT-based.

### Login

`POST /auth/login`

Request body:

```json
{
  "username": "admin_user",
  "password": "password"
}
```

Response contains:

```json
{
  "status": 200,
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  },
  "message": "User logged in successfully."
}
```

### Access Token Usage

Protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

The authorization middleware decodes the token and places `user_id` and `org_id` on the request.

### Refresh Token

`POST /auth/refresh`

Request body:

```json
{
  "refreshToken": "..."
}
```

Refresh tokens are stored in the `tokens` table. If a refresh token is close to expiry, the API returns a new refresh token.

### Logout

`GET /auth/logout`

Requires an access token. The backend deletes the stored refresh token and updates technician status when applicable.

## User Roles

The system supports three roles:

| Role | Purpose |
| --- | --- |
| `SUPER_ADMIN` | Platform-level operator. Manages organizations, admins, technicians, devices, tests, plans, and global analytics. |
| `ADMIN` | Organization-level operator. Manages technicians, devices, patients, test sessions, analytics, and reports within one organization. |
| `TECHNICIAN` | Performs patient and device workflows inside one organization. |

Role middleware is defined in `server/middleware/auth.js`.

Technician statuses:

| Status | Meaning |
| --- | --- |
| `ACTIVE` | Logged in or active without assigned device. |
| `WORKING` | Has a valid token and at least one assigned device. |
| `INACTIVE` | No valid active session. |
| `SUSPENDED` | Blocked by admin/super admin. |
| `REMOVED` | Soft-removed technician. |

## Database Model Summary

Models are located in `server/database`.

### `users`

Stores super admins, admins, and technicians.

Important fields:

- `user_id`
- `role`
- `name`
- `email`
- `username`
- `phone`
- `password`
- `org_id`
- `department_id`
- `status`

### `organizations`

Stores client organizations.

Important fields:

- `org_id`
- `org_name`
- `address`
- `phone`
- `email`
- `code`
- `org_code`
- `status`
- `plan_id`

### `departments`

Stores organization departments.

Important fields:

- `department_id`
- `department_name`

### `devices`

Stores diagnostic devices.

Important fields:

- `device_id`
- `org_id`
- `serial_no`
- `model`
- `status`
- `firmware_version`
- `last_used_at`
- `assigned_to_user_id`
- `assigned_by_user_id`
- `assigned_at`
- `department_id`

### `patients`

Stores patient records scoped by organization.

Important fields:

- `patient_id`
- `org_id`
- `name`
- `sample_id`
- `gender`
- `dob`
- `address`
- `phone`
- `email`
- `created_by`

### `test_types`

Stores available diagnostic tests.

Important fields:

- `test_type_id`
- `name`
- `full_name`
- `unit`
- `method`
- `normal_min`
- `normal_max`
- `male_min`
- `male_max`
- `female_min`
- `female_max`
- `category`
- `method_options`
- `reference_text`
- `critical_low`
- `critical_high`
- `is_qualitative`
- `specimen_type`

### `test_history`

Represents a patient testing session or visit.

Important fields:

- `history_id`
- `patient_id`
- `org_id`
- `department_id`
- `device_id`
- `entered_by_user_id`
- `test_date`
- `notes`
- `status`
- `completed_at`

### `patient_test_results`

Stores individual measurements inside a test session.

Important fields:

- `result_id`
- `history_id`
- `patient_id`
- `org_id`
- `test_type_id`
- `value_num`
- `value_text`
- `method_used`

### `plans`

Defines feature/test catalogue tiers for organizations.

Important fields:

- `plan_id`
- `name`
- `tier`
- `display_name`
- `description`
- `config`

Example `config`:

```json
{
  "allowed_specimen_types": ["Blood", "Urine"],
  "allowed_blood_tests": ["Hb", "RBS"],
  "all_tests": true,
  "allowed_device_models": ["BIO-CHEQ"]
}
```

### `plan_test_types`

Join table between plans and test types.

Important fields:

- `plan_id`
- `test_type_id`

### `tokens`

Stores refresh tokens.

Important fields:

- `id`
- `token`
- `user_id`
- `org_id`
- `expires_at`

## API Reference

Base URL for local development:

```text
http://localhost:3030
```

All protected routes require `Authorization: Bearer <accessToken>`.

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | No | Health check. Returns `OK`. |

### Auth API

Mounted at `/auth`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | No | Login with username and password. |
| POST | `/auth/refresh` | No | Refresh access token using refresh token. |
| GET | `/auth/logout` | Yes | Logout and remove stored refresh token. |

### User API

Mounted at `/user`.

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/user/profile` | All roles | Returns current user profile and organization info. |

### Super Admin API

Mounted at `/superadmin`.

All routes require `SUPER_ADMIN`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/superadmin/dashboard` | Dashboard counts and summary. |
| GET | `/superadmin/organizations/:rows/:page` | Paginated organization list. |
| GET | `/superadmin/organization/:org_id` | Organization detail. |
| POST | `/superadmin/add/organization` | Create organization. |
| PUT | `/superadmin/organization/:org_id` | Update organization. |
| DELETE | `/superadmin/organization/:org_id` | Delete organization. |
| GET | `/superadmin/admins/:rows/:page` | Paginated admin list. |
| GET | `/superadmin/admin/:admin_id` | Admin detail. |
| POST | `/superadmin/add/admin` | Create organization admin. |
| PUT | `/superadmin/admin/:admin_id` | Update organization admin. |
| GET | `/superadmin/technicians/:rows/:page` | Paginated technician list. |
| GET | `/superadmin/technician/:technician_id` | Technician detail. |
| POST | `/superadmin/add/technician` | Create technician. |
| PUT | `/superadmin/technician/:technician_id` | Update technician. |
| GET | `/superadmin/tests/:rows/:page` | Paginated test catalogue. |
| GET | `/superadmin/test/:test_type_id` | Test detail. |
| POST | `/superadmin/add/test` | Create test type. |
| PUT | `/superadmin/test/:test_type_id` | Update test type. |
| GET | `/superadmin/devices/:rows/:page` | Paginated device list. |
| GET | `/superadmin/device/:device_id` | Device detail. |
| POST | `/superadmin/add/device` | Create device. |
| PUT | `/superadmin/device/:device_id` | Update device. |
| GET | `/superadmin/plans/:rows/:page` | Paginated plan list. |
| GET | `/superadmin/plan/:plan_id` | Plan detail. |
| POST | `/superadmin/add/plan` | Create plan. |
| PUT | `/superadmin/plan/:plan_id` | Update plan. |
| GET | `/superadmin/analytics` | Platform analytics data. |

Example create organization body:

```json
{
  "org_name": "Demo Lab",
  "code": "DEMO",
  "address": "Bengaluru",
  "status": "ACTIVE",
  "plan_id": "plan-uuid"
}
```

Example create test body:

```json
{
  "name": "Hb",
  "full_name": "Hemoglobin",
  "unit": "g/dL",
  "method": "Photometry",
  "normal_min": 12,
  "normal_max": 16,
  "male_min": 13,
  "male_max": 17,
  "female_min": 12,
  "female_max": 15,
  "category": "Blood",
  "reference_text": "Adult reference range",
  "critical_low": 7,
  "critical_high": 20,
  "is_qualitative": false,
  "specimen_type": "Blood"
}
```

### Admin API

Mounted at `/admin`.

All routes require `ADMIN`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/devices/:rows/:page?` | List devices in admin organization. Supports `unassigned=true` and `status`. |
| GET | `/admin/device/:device_id` | Get one device. |
| GET | `/admin/devices-not-assign/:rows/:page?` | List devices not assigned to a technician. |
| POST | `/admin/add/technician` | Create technician in admin organization. |
| GET | `/admin/technicians/:rows/:page` | List technicians in admin organization. |
| PUT | `/admin/device/:device_id/assign` | Assign or unassign a device. |
| POST | `/admin/add/device` | Create device in admin organization. |
| GET | `/admin/technician/:technician_id` | Technician detail. |
| DELETE | `/admin/technician/:technician_id` | Remove technician. |
| GET | `/admin/patients/:rows/:page` | List patients in admin organization. |
| GET | `/admin/patient/:patient_id` | Patient detail. |
| POST | `/admin/add/patient` | Create patient. |
| PUT | `/admin/patient/:patient_id` | Update patient. |
| GET | `/admin/patient/:patient_id/tests/:rows/:page` | List patient test sessions/results. |
| GET | `/admin/session/:history_id/report` | Session report. |
| GET | `/admin/analytics/overview` | Organization analytics overview. |
| GET | `/admin/analytics/charts` | Chart data. Supports date filters. |
| GET | `/admin/analytics/test-type-sessions` | Test-type session analytics. Requires `testTypeName`. |
| GET | `/admin/analytics/tat` | Turnaround-time analytics. Supports date filters. |
| GET | `/admin/test-types` | List test types available to the organization plan. |
| POST | `/admin/patient/register-test` | Register a test session. |
| PUT | `/admin/session/:history_id/complete` | Save result values and optionally complete session. |
| GET | `/admin/reports/csv` | Generate CSV report. Requires date range. |
| GET | `/admin/reports/pdf` | Generate PDF report. Requires date range. |

Example create technician body:

```json
{
  "username": "tech001",
  "name": "Technician One",
  "email": "tech@example.com",
  "phone": "9999999999",
  "password": "secret"
}
```

Example assign device body:

```json
{
  "technician_id": "technician-user-uuid"
}
```

To unassign a device, send `technician_id` as `null` or omit it, depending on controller behavior.

Example create patient body:

```json
{
  "name": "Patient One",
  "gender": "MALE",
  "dob": "1990-01-01",
  "address": "Bengaluru",
  "phone": "9999999999",
  "email": "patient@example.com",
  "sample_id": "SAMPLE-001"
}
```

Example register test session body:

```json
{
  "patient_id": "00001",
  "test_date": "2026-05-29T10:30:00.000Z",
  "device_id": "DEVICE-001",
  "notes": "Fasting sample",
  "test_type_ids": ["test-type-uuid-1", "test-type-uuid-2"]
}
```

Example complete session body:

```json
{
  "device_id": "DEVICE-001",
  "notes": "Completed successfully",
  "complete": true,
  "tests": [
    {
      "result_id": "result-uuid",
      "value_num": 13.4,
      "value_text": null,
      "method_used": "Photometry"
    }
  ]
}
```

### Technician API

Mounted at `/technician`.

All routes require `TECHNICIAN`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/technician/patients/:rows/:page?` | List patients in technician organization. |
| GET | `/technician/patient/:patient_id` | Patient detail. |
| POST | `/technician/add/patient` | Create patient. |
| PUT | `/technician/patient/:patient_id/sample-id` | Update patient sample ID. |
| POST | `/technician/patient/add-test` | Register test session. |
| GET | `/technician/devices` | List devices assigned to current technician. |
| GET | `/technician/device/search/:device_id` | Search assigned/available device by ID. |
| GET | `/technician/test-types` | List available test types for organization plan. |
| GET | `/technician/patient/:id/tests/:rows/:page` | List patient tests. |
| GET | `/technician/test/:result_id` | Get one test result. |
| GET | `/technician/test/:result_id/report` | Get report for one result. |
| GET | `/technician/session/:history_id/report` | Get session report. |
| PUT | `/technician/session/:history_id` | Update session notes. |
| PUT | `/technician/session/:history_id/complete` | Save values and optionally complete session. |
| POST | `/technician/session/:history_id/results` | Add result values to a session. |
| PUT | `/technician/test/:result_id` | Update one test result. |
| GET | `/technician/reports/csv` | Generate CSV report. Requires date range. |
| GET | `/technician/reports/pdf` | Generate PDF report. Requires date range. |
| GET | `/technician/patient/:patient_id/today-report` | Generate today's patient report. |
| GET | `/technician/patient/:patient_id/range-report` | Generate patient report for range. Uses `fromDate` and `toDate`. |
| POST | `/technician/uart/result` | Store one or many UART results. |
| POST | `/technician/uart/complete` | Update and complete UART session results. |
| POST | `/technician/uart/save-result` | Save UART result payload. |

Example update sample ID body:

```json
{
  "sample_id": "SAMPLE-002"
}
```

Example add session results body:

```json
{
  "tests": [
    {
      "test_type_id": "test-type-uuid",
      "value_num": 98.6,
      "value_text": null,
      "method_used": "Device"
    }
  ]
}
```

Example UART single result body:

```json
{
  "patient_id": "00001",
  "test": "Hb",
  "val": 13.4,
  "method": "UART"
}
```

Example UART batch body:

```json
[
  {
    "patient_id": "00001",
    "test": "Hb",
    "val": 13.4,
    "method": "UART"
  },
  {
    "patient_id": "00001",
    "test": "RBS",
    "val": 112,
    "method": "UART"
  }
]
```

Example UART complete body:

```json
{
  "patient_id": "00001",
  "results": [
    {
      "test_name": "Hb",
      "value_num": 13.4,
      "method_used": "UART"
    },
    {
      "test_name": "Urine Color",
      "value_text": "Pale yellow",
      "method_used": "Visual"
    }
  ]
}
```

## Common Query Parameters

### Pagination

Many list endpoints use path parameters:

```text
/:rows/:page
```

`rows` is capped by `constants.PER_PAGE_ROWS_MAX`, currently `50`.

### Date Range

Report and analytics endpoints commonly use:

```text
?startDate=2026-05-01&endDate=2026-05-29
```

Some patient range report endpoints use:

```text
?fromDate=2026-05-01&toDate=2026-05-29
```

### Device Filters

Admin device list endpoints support:

```text
?unassigned=true
?status=ACTIVE
```

## Reports and Files

The backend supports CSV and PDF report generation for admins and technicians.

Relevant modules:

- `server/pdf/reportGenerator.js`
- `server/pdf/excelReportGenerator.js`
- `server/utils.js`

S3-related helpers in `server/utils.js` can:

- Check whether an object exists.
- Read CSV objects from S3.
- Upload CSV data.
- Generate signed URLs.

The default reports bucket constant is:

```text
edhaa-reports
```

## Important Workflows

### Super Admin Creates an Organization

1. Super admin logs in.
2. Super admin creates a plan or selects an existing plan.
3. Super admin creates an organization.
4. Super admin creates an organization admin linked to the organization.
5. Super admin can create devices, technicians, and tests if needed.

### Admin Creates a Technician and Assigns a Device

1. Admin logs in.
2. Admin creates technician with username, name, phone, optional email, and password.
3. Technician is created as `INACTIVE`.
4. Admin creates or selects a device.
5. Admin assigns the device to the technician.
6. When the technician logs in, status becomes `WORKING` if a device is assigned.

### Technician Registers and Completes a Test Session

1. Technician logs in.
2. Technician creates or selects a patient.
3. Technician fetches available test types.
4. Technician registers a test session with `patient_id`, `test_date`, optional `device_id`, notes, and selected test type IDs.
5. Backend creates a `test_history` row and empty `patient_test_results` rows.
6. Technician submits result values.
7. Technician marks the session complete.
8. Backend sets session status to `COMPLETED` and stores `completed_at`.

### UART Result Ingestion

1. Technician submits one or more UART result items.
2. Backend validates technician role and active status.
3. Backend validates that every patient belongs to the technician organization.
4. Backend maps test names and stores numeric/text results.
5. Technician can complete a UART session through `/technician/uart/complete`.

## Operational Notes

- The app currently performs schema changes during application startup. In production, a dedicated migration system would be safer and easier to audit.
- PostgreSQL SSL is enabled for non-localhost hosts with `rejectUnauthorized: false`.
- Passwords are hashed with bcrypt using `constants.SALT_ROUNDS`, currently `10`.
- Access tokens expire after `1d`.
- Refresh tokens expire after `1y`.
- `body-parser` limits JSON and URL-encoded payloads to `50mb`.
- Time utilities currently use `Asia/Kolkata`.
- The repository contains AWS SDK v2 and v3 dependencies.

## Known Gaps

- `npm test` is a placeholder and currently exits with an error.
- There is no dedicated migration framework in the repository.
- Request/response schemas are not enforced by a central validation library.
- Some comments and package metadata still reference older project wording.
- API documentation is maintained manually in this README; consider OpenAPI/Swagger if clients depend on generated contracts.

## Useful Commands

Install dependencies:

```bash
npm install
```

Run in default `dev` mode:

```bash
npm start
```

Run explicitly in production mode:

```bash
node server/app.js prod
```

Health check:

```bash
curl http://localhost:3030/health
```

## License

The package is currently marked as `ISC` in `package.json`.
