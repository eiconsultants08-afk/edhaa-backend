import { DataTypes } from 'sequelize';
import sequelize from '../connectdb.js';
import Energy from './energy.js';

const EnergyPerformance = sequelize.define('energy_performance', {
    project_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Energy,
            key: 'project_id'
        }
    },
    dates: { 
        type: DataTypes.DATE,
        allowNull: false,
    },
    total_power_scheduled: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    total_power_generated: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    tariff: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    dsm: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    revenue_loss_115_120: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    revenue_loss_above_120: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    impact: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
    total_impact_in_lakhs: {
        type: DataTypes.FLOAT,
        defaultValue: null
    },
},{ tableName: 'energy_performance', timestamps: false }
);

EnergyPerformance.belongsTo(Energy, {
    foreignKey: 'project_id',
    as: 'energy',
  });

export default EnergyPerformance;
