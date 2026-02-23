export const environment = process.argv[2] || "dev";
import { configuration,subscriptionConfiguration } from "./config.js";

export const config = configuration[environment];

//ENVIRONMENT FOR CC AVENUE 
//IF WORKING WITH REPORT OR WEBSITE OR ANY OTHER PAYMENT SERVICES MAKE CHANGES 
// FOR WEBSITE 
export let WebsiteCCAvenueEnv = 'prodreport'; // (stg - testing, prodreport - live) 

// FOR VIYAT 
export let ViyatCCAvenueEnv = 'prod'; // default 

export const setSubscriptionEnv = (env) =>  ViyatCCAvenueEnv = env;

export const subscriptionConfig = new Proxy({}, { get: (_, prop) => subscriptionConfiguration[ViyatCCAvenueEnv]?.[prop]});

export const constants = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  TECHNICIAN: "TECHNICIAN",

  SALT_ROUNDS: 10,
  EXPIRY_ACCESS_TOKEN: "1d",
  EXPIRY_REFRESH_TOKEN: "1y",
  EXPIRES_IN: 15,

  ACCESS_TOKEN_SECRET: "secret",
  REFRESH_TOKEN_SECRET: "refreshsecret",

  PER_PAGE_ROWS_MAX: 50,

  ADD_TECHNICIAN_ATTRIBUTES: ["username", "name", "email", "phone", "password"],
  USER_ATTRIBUTES: ["user_id", "username", "name", "email", "phone", "role", "status", "org_id", "department_id", "created_at", "updated_at"],
};