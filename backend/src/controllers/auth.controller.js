const db = require('../models');
const config = require('../config/auth.config');
const User = db.User;
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password
    });
    res.status(201).send({ message: 'User registered successfully!' });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { username: req.body.username }
    });
    if (!user) return res.status(404).send({ message: 'User Not found.' });

    const passwordIsValid = await user.isValidPassword(req.body.password);
    if (!passwordIsValid) {
      return res.status(401).send({ accessToken: null, message: 'Invalid Password!' });
    }

    const token = jwt.sign({ id: user.id }, config.secret, {
      expiresIn: config.jwtExpiration
    });

    res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      accessToken: token,
      monthlyLimit: user.monthlyLimit
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};