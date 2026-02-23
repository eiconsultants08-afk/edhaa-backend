import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config } from "./constants.js";
import register from './routes.js';
import sequelize from './database/connectdb.js';
// import connectToRDS from './database/connectrds.js';

const app = express();

//NEED to be change to https

//To allow request from UI application
app.use(cors({
    origin: config.ui
}));

// app.use(bodyParser.urlencoded({ extended: true }));

// // //To parse json data
// app.use(bodyParser.json());

//To parse URL encoded data
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


app.use((req, res, next) => {
    const allowedOrigins = config.ui;
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


register(app);

// connectToRDS().then(() => {
//     app.listen(config.port, () => {
//         startPostgres();
//         console.log("Connected to RDS via SSH tunnel");
//     });
// }, (err) => {
//     console.error(err)
// });

app.listen(config.port, () => {
  startPostgres();
  console.log(`server running on port ${config.port}`);
});

async function startPostgres() {
    try {
      await sequelize.authenticate();
      console.log("✅ Database connection successful!");
  
      const [results] = await sequelize.query("SELECT current_database();");
      console.log("📌 Connected to DB:", results[0].current_database);
  
      await sequelize.sync();
      console.log("✅ Models synced!");
    } catch (err) {
      console.error("❌ DB Connection failed:", err);
    }
  }