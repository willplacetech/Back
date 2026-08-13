const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pedidoController');

router.get('/', ctrl.listar);
router.post('/', ctrl.criar);
router.put('/:id/status', ctrl.atualizarStatus);

module.exports = router;