const bcrypt = require('bcryptjs');

module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define('users', {
    username: { type: Sequelize.STRING, unique: true, allowNull: false },
    email: { type: Sequelize.STRING, unique: true, allowNull: false, validate: { isEmail: true } },
    password: { type: Sequelize.STRING, allowNull: false },
    defaultCurrency: { type: Sequelize.STRING, defaultValue: 'VND' },
    monthlyLimit: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true, // Cho phép null
      defaultValue: null  // Mặc định là null cho user mới
    }
  });

  User.beforeCreate(async (user) => {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  });

  User.prototype.isValidPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  User.associate = (models) => {
    User.hasMany(models.Transaction, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.Category, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.Budget, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return User;
};