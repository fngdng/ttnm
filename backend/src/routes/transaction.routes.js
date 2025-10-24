const controller = require('../controllers/transaction.controller');
const { authJwt } = require('../middlewares');

module.exports = function(app) {
  const router = require('express').Router();
  router.use(authJwt.verifyToken); // Bảo vệ tất cả route
  router.post('/', controller.create);
  router.get('/', controller.findAll);
  router.get('/:id', controller.findOne);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);
  app.use('/api/transactions', router);
};