const controller = require('../controllers/report.controller');
const { authJwt } = require('../middlewares');

module.exports = function(app) {
  const router = require('express').Router();
  router.use(authJwt.verifyToken);
  router.get('/summary', controller.getSummary);
  router.get('/by-category', controller.getReportByCategory);
  router.get('/budget-progress', controller.getBudgetProgress); // Route mới
  router.get('/export-excel', controller.exportExcel);
  app.use('/api/reports', router);
};