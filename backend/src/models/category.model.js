module.exports = (sequelize, Sequelize) => {
  const Category = sequelize.define('categories', {
    name: { type: Sequelize.STRING, allowNull: false },
    type: { type: Sequelize.ENUM('expense', 'income'), allowNull: false },
    icon: { type: Sequelize.STRING }
  });

  Category.associate = (models) => {
    Category.belongsTo(models.User, { foreignKey: 'userId', allowNull: false });
    Category.hasMany(models.Transaction, { foreignKey: 'categoryId', onDelete: 'SET NULL' });
    Category.hasMany(models.Budget, { foreignKey: 'categoryId' });
  };

  return Category;
};