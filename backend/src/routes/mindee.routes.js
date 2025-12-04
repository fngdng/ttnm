const express = require('express');
const router = express.Router();
const multer = require('multer');
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

const controller = require('../controllers/mindee.controller');
const { authJwt } = require('../middlewares');

module.exports = function(app) {
  router.post('/scan', upload.single('file'), controller.scan);
  router.post('/debug', upload.single('file'), controller.debug);
  app.use('/api/mindee', router);
};
