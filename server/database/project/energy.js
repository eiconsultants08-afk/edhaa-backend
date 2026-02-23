import { DataTypes } from 'sequelize';
import sequelize from '../connectdb.js';
import Organization from '../organization.js';
import User from '../users.js'; 

const Energy = sequelize.define('energy', {
    project_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    project_name: {
        type: DataTypes.ARRAY(DataTypes.TEXT), // Define as an array of text
        allowNull: false
    },
    org_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Organization, // Reference to Organization model
            key: 'org_id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User, // Reference to User model
            key: 'user_id'
        }
    },
    intraday_status: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    dayahead_status: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    ppa: {
        type: DataTypes.INTEGER,
        defaultValue: null
    },
    turbine_count: {
        type: DataTypes.INTEGER,
        defaultValue: null
    },
    turbine_rating: {
        type: DataTypes.INTEGER,
        defaultValue: null
    },
    farm_rating: {
        type: DataTypes.INTEGER,
        defaultValue: null
    },
    dashboard_enabled: {
        type: DataTypes.BOOLEAN,
    }
},{ tableName: 'energy'}
);

// Define associations
Energy.belongsTo(Organization, { foreignKey: 'org_id' });
Organization.hasMany(Energy, { foreignKey: 'org_id' });

Energy.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Energy, { foreignKey: 'user_id' });

export default Energy;
