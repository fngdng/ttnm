const controller = require('../controllers/budget.controller');
const { authJwt } = require('../middlewares');

module.exports = function(app) {
  const router = require('express').Router();
  router.use(authJwt.verifyToken);
  router.post('/', controller.setBudget);
  router.get('/', controller.findAll);
  router.delete('/:id', controller.delete);
  app.use('/api/budgets', router);
};