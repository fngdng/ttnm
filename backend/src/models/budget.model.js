module.exports = (sequelize, Sequelize) => {
  const Budget = sequelize.define('budgets', {
    amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
    startDate: { type: Sequelize.DATEONLY, allowNull: false },
    endDate: { type: Sequelize.DATEONLY, allowNull: false }
  });

  Budget.associate = (models) => {
    Budget.belongsTo(models.User, { foreignKey: 'userId', allowNull: false });
    Budget.belongsTo(models.Category, { foreignKey: 'categoryId', allowNull: false });
  };

  return Budget;
};