import { readFileSync } from "fs";
import { secrets } from "./secret/secrets.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
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
    // sshConfig: {
    //   host: '3.108.55.74',
    //   port: 22,
    //   username: 'ubuntu',
    //   privateKey: readFileSync('server/datacast_test.pem'),
    // },
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

export const subscriptionConfiguration = {
  dev: {
    backendUrl: "http://localhost:3030",
    clientUrl: "http://localhost:3000",
    workingKey: '04D4BAD6BE7A8CAAEFFFD0B3D08BDF35',
    accessCode: 'ATGN05LG83AY51NGYA',
    ccUrl:'https://test.ccavenue.com'
  },
  stg: {
    backendUrl: "https://testapi.weathercastsolutions.com",
    clientUrl: "https://test.weathercastsolutions.com",
    workingKey: 'F0BC1E60E5D3DE3EDD37B1912FA2F3A4',
    accessCode: 'ATFN05LG83AY50NFYA',
    ccUrl:'https://test.ccavenue.com'
  },
  prod: {
    backendUrl: "https://api.weathercastsolutions.com",
    clientUrl: "https://viyat.weathercastsolutions.com",
    workingKey: '3CD4D47E5129781F1E9222F95E7BCA24',
    accessCode: 'AVSV89LE86CG68VSGC',
    ccUrl:'https://secure.ccavenue.com'
  },
  prodreport: {
    backendUrl: "https://api.weathercastsolutions.com",
    clientUrl: "https://www.weathercastsolutions.com",
    workingKey: 'EF0DCD3270B227B1FF4C8341A99CA6B3',
    accessCode: 'AVBS65MD46AU54SBUA', 
    ccUrl: 'https://secure.ccavenue.com' 
  },
};

export default async function createDynamoDBClient() {

  const dynamoDBClient = new DynamoDBClient({
    region: 'ap-south-1',
    credentials: {
      accessKeyId: secrets.AWS_ACCESS_KEY_ID,
      secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY,
    },
  });
  
  return DynamoDBDocumentClient.from(dynamoDBClient);;
}


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
