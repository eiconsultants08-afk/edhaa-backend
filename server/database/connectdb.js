import Sequelize from 'sequelize';
import { config } from '../constants.js';

const pgconfig = config.postgres;

const sequelize = new Sequelize(pgconfig.database, pgconfig.username, pgconfig.password, {
    host: pgconfig.host,
    dialect: pgconfig.dialect,
    port: pgconfig.port,
    pool: {
      max: 9,
      min: 0,
      idle: 10000
    },
    // logging: false
     // ✅ Required for many RDS PostgreSQL setups
     dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // dev-friendly; for prod use CA cert
      },
    },

});

export default sequelize;