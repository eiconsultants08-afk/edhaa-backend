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
      "http://localhost:5173"
    ],
    port: 3030,
  },
  prod: {
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
    ui: ["https://biocheq.edhaainnovations.com"],
    port: 3030,
  },
};
