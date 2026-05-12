import { readFileSync } from "fs";
import { secrets } from "./secret/secrets.js";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";

export const configuration = {
  dev: {
    postgres: {
      username: secrets.USERNAME,
      dialect: "postgres",
      password: secrets.PASSWORD,
      database: secrets.DATABASE,
      host: secrets.HOST,
      port: 5432,
    },

    jwt: {
      secret: secrets.SECRET,
      refreshsecret: secrets.REFRESH_SECRET,
    },
    ui: [
      "http://localhost:3000",
      "http://www.localhost:3000",
      "http://localhost:5173",
      "http://10.137.14.218:3000"
    ],
    port: 3030,
  },
  stg: {
    postgres: {
      database: "datacast",
      username: "postgres",
      password: "datacast123$",
      dialect: "postgres",
      host: "datacast-test-02.ckgdsdftfxnu.ap-south-1.rds.amazonaws.com",
      port: 5432,
    },
    jwt: {
      secret: "lala",
      refreshsecret: "refreshlala",
    },
    ui: "http://localhost:3000",
    port: 3030,
  },
  prod: {
    postgres: {
      database: "datacast",
      username: "postgres",
      password: "admin",
      dialect: "postgres",
      host: "localhost",
    },
    jwt: {
      secret: "",
      refreshsecret: "",
    },
    ui: "http://localhost:3000",
    port: 3000,
  },
};



// export async function verifyDynamoDBConnection() {
//   try {
//     const client = await createDynamoDBClient();
//     const command = new ListTablesCommand({});
//     const data = await client.send(command);
//     console.log("✅ DynamoDB Connection Successful. Tables:", data.TableNames);
//     return { success: true, tables: data.TableNames };
//   } catch (error) {
//     console.error("❌ DynamoDB Connection Failed:", error);
//     return { success: false, error: error.message };
//   }
// }

// verifyDynamoDBConnection()
// AWS DB :
// postgres: {
//     database: "Datacast_DB",
//     username: "postgres",
//     password: "datacast123$",
//     dialect: "postgres",
//     host: "datacast-test-01.ckgdsdftfxnu.ap-south-1.rds.amazonaws.com",
// };
