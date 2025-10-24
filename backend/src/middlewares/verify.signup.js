const db = require('../models');
const User = db.User;

const checkDuplicateUsernameOrEmail = async (req, res, next) => {
  try {
    let user = await User.findOne({ where: { username: req.body.username } });
    if (user) {
      return res.status(400).send({ message: 'Failed! Username is already in use!' });
    }

    user = await User.findOne({ where: { email: req.body.email } });
    if (user) {
      return res.status(400).send({ message: 'Failed! Email is already in use!' });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

module.exports = { checkDuplicateUsernameOrEmail };