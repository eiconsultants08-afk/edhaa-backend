import { SSM } from "@aws-sdk/client-ssm";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

// ✅ SSM client (Parameter Store)
const ssm = new SSM({ region: "ap-south-1" });

async function getStringParameter(name, secure = false) {
  try {
    const params = { Name: name };

    if (secure) {
      params.WithDecryption = true;
    }

    const data = await ssm.getParameter(params);
    return data?.Parameter?.Value ?? null;
  } catch (err) {
    console.error(`Error retrieving parameter (${name}):`, err);
    return null;
  }
}

// ✅ Matches your actual Parameter Store names (from screenshot)
export const secrets = {
  USERNAME: await getStringParameter("DB_USERNAME"),
  PASSWORD: await getStringParameter("DB_PASSWORD", true),
  DATABASE: await getStringParameter("DB_NAME"),
  HOST: await getStringParameter("DB_HOST"),
  SECRET: await getStringParameter("secrets", true),
  REFRESH_SECRET: await getStringParameter("refresh_secret", true),
};