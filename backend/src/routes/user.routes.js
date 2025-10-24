const controller = require('../controllers/user.controller');
const { authJwt } = require('../middlewares');

module.exports = function(app) {
  const router = require('express').Router();

  router.put('/limit', authJwt.verifyToken, controller.setSpendingLimit);
  
  app.use('/api/users', router);
};