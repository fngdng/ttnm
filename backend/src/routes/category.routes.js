const controller = require('../controllers/category.controller');
const { authJwt } = require('../middlewares');

module.exports = function(app) {
  const router = require('express').Router();
  router.use(authJwt.verifyToken);
  router.post('/', controller.create);
  router.get('/', controller.findAll);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);
  app.use('/api/categories', router);
};