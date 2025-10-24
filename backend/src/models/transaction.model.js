module.exports = (sequelize, Sequelize) => {
  const Transaction = sequelize.define('transactions', {
    description: { type: Sequelize.STRING },
    amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
    date: { type: Sequelize.DATEONLY, allowNull: false },
    type: { type: Sequelize.ENUM('expense', 'income'), allowNull: false }
  });

  Transaction.associate = (models) => {
    Transaction.belongsTo(models.User, { foreignKey: 'userId', allowNull: false });
    Transaction.belongsTo(models.Category, { foreignKey: 'categoryId', allowNull: true });
  };

  return Transaction;
};