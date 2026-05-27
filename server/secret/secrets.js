// import { SSM } from "@aws-sdk/client-ssm";
// import dotenv from "dotenv";
// import { fileURLToPath } from "url";
// import { dirname, resolve } from "path";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// dotenv.config({ path: resolve(__dirname, "../../.env") }); // Load .env relative to this file

// // ✅ SSM client (Parameter Store)
// const ssm = new SSM({ region: "ap-south-1" });

// async function getStringParameter(name, secure = false) {
//   if (process.env[name] !== undefined) {
//     return process.env[name] ?? null;
//   }
//   try {
//     const params = { Name: name };

//     if (secure) {
//       params.WithDecryption = true;
//     }

//     const data = await ssm.getParameter(params);
//     return data?.Parameter?.Value ?? null;
//   } catch (err) {
//     console.error(`Error retrieving parameter (${name}):`, err);
//     return null;
//   }
// }

// // ✅ Matches your actual Parameter Store names (from screenshot)
// export const secrets = {
//   USERNAME: await getStringParameter("DB_USERNAME"),
//   PASSWORD: await getStringParameter("DB_PASSWORD", true),
//   DATABASE: await getStringParameter("DB_NAME"),
//   HOST: await getStringParameter("DB_HOST"),
//   SECRET: await getStringParameter("secrets", true),
//   REFRESH_SECRET: await getStringParameter("refresh_secret", true),
// };


import {
  SSMClient,
  GetParameterCommand,
} from "@aws-sdk/client-ssm";

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env only for local/dev
dotenv.config({
  path: resolve(__dirname, "../../.env"),
});

// AWS SSM Client
const ssm = new SSMClient({
  region: "ap-south-1",
});

async function getStringParameter(name, secure = false) {

  // ✅ Use .env ONLY in non-prod
  if (
    process.argv[2] !== "prod" &&
    process.env[name] !== undefined
  ) {
    return process.env[name];
  }

  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: secure,
    });

    const data = await ssm.send(command);

    console.log(`✅ Loaded SSM parameter: ${name}`);

    return data?.Parameter?.Value || null;

  } catch (err) {

    console.error(`❌ Error retrieving parameter (${name}):`, err);

    return null;
  }
}

// Export secrets
export const secrets = {
  USERNAME: await getStringParameter("DB_USERNAME"),
  PASSWORD: await getStringParameter("DB_PASSWORD", true),
  DATABASE: await getStringParameter("DB_NAME"),
  HOST: await getStringParameter("DB_HOST"),
  SECRET: await getStringParameter("secrets", true),
  REFRESH_SECRET: await getStringParameter("refresh_secret", true),
};
