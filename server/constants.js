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
    ADMIN: "ADMIN",
    USER: "USER",
    SUBADMIN: "SUBADMIN",
    ENERGY:'ENERGYUSER',
    EADMIN: 'EADMIN',
    EUSER: 'EUSER',
    POWER_ANALYST: 'POWER_ANALYST',
    
    SALT_ROUNDS: 10,
    EXPIRY_ACCESS_TOKEN: "1d",
    EXPIRY_REFRESH_TOKEN: "1y",
    EXPIRES_IN: 15,
    ACCESS_TOKEN_SECRET: "secret",
    REFRESH_TOKEN_SECRET: "refreshsecret",
    PER_PAGE_ROWS_MAX: 192,

    MAX_DAY_DATA: 7,
    MAX_DAY_USER_HISTORIC_DATA: 90,
    MAX_LIVE_DATA: 2,

    USER_ATTRIBUTES: ["id", "username", "name", "email", "phone", "org_id", "role", "createdAt", "updatedAt"],
    USER_PROFILE: [ "id", "username", "name", "email", "phone", "org_id", "address_line1", "address_line2", "address_line3" ],    
};