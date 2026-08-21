const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pedidoController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, ctrl.listar);
router.post('/', ctrl.criar);
router.put('/:id/status', requireAuth, ctrl.atualizarStatus);

module.exports = router;